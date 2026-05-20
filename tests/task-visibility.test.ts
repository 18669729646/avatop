import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildQueueStatsSearchParams, buildTaskQueueSearchParams } from '../src/lib/queue';
import { isAnalysisMasterTaskType } from '../src/lib/task-types';

describe('task visibility filters', () => {
  it('detects analysis master task types', () => {
    assert.equal(isAnalysisMasterTaskType('analysis'), true);
    assert.equal(isAnalysisMasterTaskType('analysis_batch_import'), true);
    assert.equal(isAnalysisMasterTaskType('video'), false);
    assert.equal(isAnalysisMasterTaskType(undefined), false);
  });

  it('builds hidden-analysis query params by default', () => {
    const taskParams = buildTaskQueueSearchParams('mine');
    const statsParams = buildQueueStatsSearchParams('all');

    assert.equal(taskParams.get('excludeAnalysisMaster'), 'true');
    assert.equal(taskParams.get('viewAll'), null);
    assert.equal(statsParams.get('excludeAnalysisMaster'), 'true');
    assert.equal(statsParams.get('viewAll'), 'true');
  });

  it('allows analysis master pages to opt out of filtering', () => {
    const taskParams = buildTaskQueueSearchParams('mine', { excludeAnalysisMaster: false });
    const statsParams = buildQueueStatsSearchParams('mine', { excludeAnalysisMaster: false });

    assert.equal(taskParams.get('excludeAnalysisMaster'), null);
    assert.equal(statsParams.get('excludeAnalysisMaster'), null);
  });
});
