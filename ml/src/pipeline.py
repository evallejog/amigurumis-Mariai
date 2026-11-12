"""Read-only, reproducible exploratory demand pipeline. Never writes commercial SQLite."""
from __future__ import annotations
import argparse, json, sqlite3, uuid
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
ROOT=Path(__file__).resolve().parents[1]; ART=ROOT/'artifacts'; CFG=json.loads((ROOT/'config'/'experiment.json').read_text())
def synthetic():
    rng=np.random.default_rng(CFG['seed']); weeks=pd.date_range('2025-01-06',periods=52,freq='W-MON'); rows=[]
    for i in range(4):
        for t,d in enumerate(weeks): rows.append({'date_utc':d.isoformat(),'product_id':f'ACA-{i+1:02d}','category':'academic','units':max(0,int(4+i+2*np.sin(t/6)+rng.normal(0,1.2)))})
    return pd.DataFrame(rows)
def extract(db_path:str):
    uri=f'file:{Path(db_path).resolve().as_posix()}?mode=ro'; con=sqlite3.connect(uri,uri=True)
    try: return pd.read_sql_query("""SELECT oi.product_id, substr(o.created_at,1,10) date_utc, SUM(oi.quantity) units, MAX(p.category) category FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id WHERE o.status != 'cancelado' GROUP BY oi.product_id, substr(o.created_at,1,10)""",con)
    finally: con.close()
def quality(df,source):
    invalid_dates=int(pd.to_datetime(df.date_utc,errors='coerce',utc=True).isna().sum()); negative=int((df.units<0).sum()); dup=int(df.duplicated(['product_id','date_utc']).sum()); obs=len(df); series=df.product_id.nunique(); status='evaluable' if obs>=CFG['minimum_observations'] and series>=CFG['minimum_series'] else ('exploratory' if obs>=8 else 'insufficient')
    return {'data_source':source,'observations':obs,'products':int(series),'period_start':str(df.date_utc.min()) if obs else None,'period_end':str(df.date_utc.max()) if obs else None,'missing_values':int(df.isna().sum().sum()),'duplicates':dup,'negative_quantities':negative,'invalid_dates':invalid_dates,'zero_sales_periods':int((df.units==0).sum()),'sufficiency':status,'warnings':['Ventas observadas no equivalen a demanda total; no hay disponibilidad histórica.'] if status!='evaluable' else []}
def evaluate(df,source):
    """Per-product recursive four-step forecasts; choose only on validation, report final test separately."""
    horizon=int(CFG['horizon']); df=df.copy(); df['date']=pd.to_datetime(df.date_utc,utc=True); df=df.sort_values(['product_id','date']); validations={}; tests={}; val_points=[]; test_points=[]; cutoffs=[]
    def forecast(history, model):
        values=list(map(float,history)); result=[]
        for _ in range(horizon):
            if model=='naive_last': pred=values[-1]
            elif model=='historical_mean': pred=float(np.mean(values))
            else:
                x=np.arange(len(values),dtype=float).reshape(-1,1); y=np.asarray(values,dtype=float); fit=Ridge(alpha=1.0).fit(x,y); pred=float(fit.predict([[len(values)]])[0])
            pred=max(0.0,float(pred)); result.append(pred); values.append(pred)
        return result
    test_candidates=[]
    for pid,g in df.groupby('product_id'):
        g=g.dropna(subset=['date_utc','units']).reset_index(drop=True)
        if len(g)<3*horizon+4: continue
        vals=g.units.to_numpy(dtype=float); n=len(vals); train_end=max(horizon+2,int(n*.6)); valid_end=max(train_end+horizon,int(n*.8))
        if valid_end+horizon>n: valid_end=n-horizon
        if train_end+horizon>valid_end or valid_end+horizon>n: continue
        cutoffs.append({'product_id':str(pid),'train_end':g.date.iloc[train_end-1].isoformat(),'validation_end':g.date.iloc[valid_end-1].isoformat(),'test_end':g.date.iloc[n-1].isoformat()})
        for name in ('naive_last','historical_mean','ridge_lag1'):
            vp=forecast(vals[:train_end],name); va=vals[train_end:train_end+horizon]; validations.setdefault(name,[[],[]]); validations[name][0].extend(va); validations[name][1].extend(vp)
        test_candidates.append((pid,g,valid_end))
    def metric_rows(source_map):
        rows=[]
        for name,(actual,pred) in source_map.items():
            a=np.asarray(actual,dtype=float); p=np.asarray(pred,dtype=float); err=a-p; denom=float(np.abs(a).sum())
            rows.append({'model':name,'mae':float(np.abs(err).mean()),'rmse':float(np.sqrt(np.mean(err**2))),'wape':None if denom==0 else float(100*np.abs(err).sum()/denom),'bias':float(err.mean()),'observations':int(len(a))})
        return rows
    validation_models=metric_rows(validations); test_models=metric_rows(tests)
    selected=min(validation_models,key=lambda x:x['mae'])['model'] if validation_models else None
    tests={}
    if selected:
        for pid,g,valid_end in test_candidates:
            pred=forecast(g.units.to_numpy(dtype=float)[:valid_end],selected)
            actual=g.units.to_numpy(dtype=float)[valid_end:valid_end+horizon]
            tests.setdefault(selected,[[],[]]); tests[selected][0].extend(actual); tests[selected][1].extend(pred)
            test_points.extend({'product_id':str(pid),'date_utc':g.date.iloc[valid_end+j].isoformat(),'actual':float(actual[j]),'predicted':float(pred[j])} for j in range(min(horizon,len(pred))))
    test_models=metric_rows(tests)
    return {'data_source':source,'status':'evaluated' if selected and test_models else 'insufficient','evaluation_protocol':'recursive_multi_horizon_v2','horizon':horizon,'strategy':'recursive','cutoffs':cutoffs,'validation_models':validation_models,'test_models':test_models,'models':test_models,'selected_model':selected,'test_points':test_points[:200],'warnings':['Forecast recursivo; cada partición predice cuatro periodos sin consumir valores futuros. La selección usa validación; test se reporta aparte.']}
def run(source,db_path=None,output_dir=None):
    df=synthetic() if source=='synthetic' else extract(db_path); origin='synthetic_academic' if source=='synthetic' else 'real_commercial'; q=quality(df,origin); stamp=datetime.now(timezone.utc).isoformat(); run_id=str(uuid.uuid4()); artifacts=Path(output_dir).resolve() if output_dir else ART; run_dir=artifacts/'runs'/run_id; run_dir.mkdir(parents=True,exist_ok=False); trained=q['sufficiency']=='evaluable'; ev=evaluate(df,origin) if trained else {'data_source':origin,'status':'insufficient','evaluation_protocol':'recursive_multi_horizon_v2','horizon':int(CFG['horizon']),'strategy':'recursive','models':[],'validation_models':[],'test_models':[],'selected_model':None,'test_points':[],'warnings':['Entrenamiento detenido: datos insuficientes.']}; preds=[]
    manifest={'run_id':run_id,'generated_at':stamp,'data_source':origin,'granularity':CFG['granularity'],'horizon':CFG['horizon'],'observations':q['observations'],'products':q['products'],'pipeline_version':CFG['pipeline_version'],'training_status':'completed' if trained else 'skipped','reason':None if trained else 'insufficient_data','sufficiency':q['sufficiency'],'evaluation_protocol':ev.get('evaluation_protocol'),'methodology_version':'recursive_multi_horizon_v2' if trained else None}
    for name,obj in [('data_quality',q),('evaluation',ev),('predictions',{'data_source':origin,'status':'not_production_recommendation','predictions':preds,'warnings':['Predicciones exploratorias no son decisiones de inventario.']}),('manifest',manifest)]: (run_dir/f'{name}.json').write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    # Backward-compatible current-run snapshots. Per-run directories preserve source history.
    if output_dir is None:
        ART.mkdir(exist_ok=True)
        for name in ('data_quality','evaluation','predictions','manifest'): (ART/f'{name}.json').write_text((run_dir/f'{name}.json').read_text(encoding='utf-8'),encoding='utf-8')
    return manifest
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',choices=['synthetic','real'],required=True);p.add_argument('--db');p.add_argument('--output-dir');a=p.parse_args();print(json.dumps(run(a.source,a.db,a.output_dir),ensure_ascii=False))
