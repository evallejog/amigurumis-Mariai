import json
from src.pipeline import run


def test_run_contract_and_source_are_written_only_to_temp_dir(tmp_path):
    manifest = run('synthetic', output_dir=tmp_path)
    assert manifest['data_source'] == 'synthetic_academic'
    assert manifest['training_status'] == 'completed'
    assert manifest['evaluation_protocol'] == 'recursive_multi_horizon_v2'
    path = tmp_path / 'runs' / manifest['run_id'] / 'manifest.json'
    assert json.loads(path.read_text()) == manifest
    assert not (tmp_path / 'manifest.json').exists()
