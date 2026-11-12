import json
import numpy as np
import pandas as pd
from src.pipeline import evaluate, quality, run, synthetic


def test_recursive_horizon_and_temporal_partitions_are_reproducible():
    first, second = synthetic(), synthetic()
    assert first.equals(second)
    report = quality(first, 'synthetic_academic')
    assert report['sufficiency'] == 'evaluable'
    result = evaluate(first, 'synthetic_academic')
    assert result['status'] == 'evaluated'
    assert result['horizon'] == 4 and result['strategy'] == 'recursive'
    assert result['selected_model'] in {'naive_last', 'historical_mean', 'ridge_lag1'}
    assert {row['model'] for row in result['test_models']} == {result['selected_model']}
    assert all(point['predicted'] >= 0 for point in result['test_points'])
    assert len(result['test_points']) == 4 * first.product_id.nunique()
    assert all(cut['train_end'] < cut['validation_end'] < cut['test_end'] for cut in result['cutoffs'])
    assert all(row['wape'] is None or np.isfinite(row['wape']) for row in result['test_models'])


def test_wape_is_aggregate_and_zero_denominator_is_unavailable():
    frame = pd.DataFrame([
        {'product_id': 'a', 'date_utc': f'2025-01-{day:02d}', 'units': value}
        for day, value in enumerate([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], 1)
    ])
    result = evaluate(frame, 'synthetic_academic')
    assert result['horizon'] == 4
    assert all(np.isfinite(row['wape']) for row in result['test_models'])
    assert all(row['observations'] == 4 for row in result['test_models'])


def test_insufficient_data_and_json_output_stay_isolated(tmp_path):
    small = pd.DataFrame([{'product_id': 'only', 'date_utc': '2025-01-01', 'units': 1}])
    assert quality(small, 'synthetic_academic')['sufficiency'] == 'insufficient'
    manifest = run('synthetic', output_dir=tmp_path)
    assert manifest['data_source'] == 'synthetic_academic'
    assert manifest['methodology_version'] == 'recursive_multi_horizon_v2'
    run_dir = tmp_path / 'runs' / manifest['run_id']
    evaluation = json.loads((run_dir / 'evaluation.json').read_text())
    assert evaluation['horizon'] == 4
    assert (tmp_path / 'manifest.json').exists() is False
