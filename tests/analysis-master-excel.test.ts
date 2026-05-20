import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as XLSX from 'xlsx';
import {
  buildAnalysisMasterExportRows,
  extractAnalysisMasterImports,
} from '../src/lib/analysis-master-excel';

function workbookBuffer(rows: Record<string, string>[]): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

describe('analysis master excel helpers', () => {
  it('extracts TikTok and Douyin urls with row metadata from any column', () => {
    const buffer = workbookBuffer([
      {
        product: 'Coffee Mug',
        handle: '@maker',
        link: 'www.tiktok.com/@maker/video/123',
      },
      {
        product: 'Desk Lamp',
        note: 'https://www.douyin.com/video/456',
        price: '88',
      },
      {
        product: 'Updated Mug',
        handle: '@maker-updated',
        link: 'https://www.tiktok.com/@maker/video/123',
      },
    ]);

    const imports = extractAnalysisMasterImports(buffer);

    assert.equal(imports.length, 2);
    assert.equal(imports[0].sourceUrl, 'https://www.tiktok.com/@maker/video/123');
    assert.deepEqual(imports[0].metadata, {
      product: 'Updated Mug',
      handle: '@maker-updated',
    });
    assert.equal(imports[1].sourceUrl, 'https://www.douyin.com/video/456');
    assert.deepEqual(imports[1].metadata, {
      product: 'Desk Lamp',
      price: '88',
    });
  });

  it('builds one export row per scene and preserves imported metadata', () => {
    const rows = buildAnalysisMasterExportRows([
      {
        id: 'am-1',
        name: 'Imported video',
        sourceType: 'link',
        sourceUrl: 'https://www.tiktok.com/@maker/video/123',
        status: 'completed',
        error: null,
        importMetadata: { product: 'Coffee Mug', price: '42' },
        result: {
          summary: 'short summary',
          videoType: '带货',
          targetAudience: 'office workers',
          sellingPoints: ['portable'],
          scenes: [
            {
              id: 'scene-1',
              order: 1,
              duration: 8,
              title: 'Hook',
              description: 'Creator shows the product',
              imagePrompt: 'image prompt',
              videoPrompt: 'video prompt',
              dialogueVoOriginal: 'Buy this mug',
              dialogueVoZh: '买这个杯子',
              ctaA: 'hook text',
              actionScheduling: 'hold product',
              cameraShotSize: 'close up',
            },
          ],
        },
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-20T00:01:00.000Z',
      },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]['椤圭洰ID'], 'am-1');
    assert.equal(rows[0]['URL'], 'https://www.tiktok.com/@maker/video/123');
    assert.equal(rows[0].product, 'Coffee Mug');
    assert.equal(rows[0].price, '42');
    assert.equal(rows[0]['分镜序号'], 1);
    assert.equal(rows[0]['台词原文(dialogue_vo_original)'], 'Buy this mug');
    assert.equal(rows[0]['台词中文(dialogue_vo_zh)'], '买这个杯子');
    assert.equal(rows[0]['cta_a'], 'hook text');
    assert.equal(rows[0]['动作调度(action_scheduling)'], 'hold product');
    assert.equal(rows[0]['景别(camera_shot_size)'], 'close up');
  });

  it('puts project summary columns at the far right of export rows', () => {
    const rows = buildAnalysisMasterExportRows([
      {
        id: 'am-2',
        name: 'Ordered export',
        sourceType: 'link',
        sourceUrl: 'https://www.tiktok.com/@maker/video/999',
        status: 'completed',
        error: null,
        importMetadata: { product: 'Bottle' },
        result: {
          summary: 'summary',
          videoType: '带货',
          targetAudience: 'users',
          sellingPoints: ['portable'],
          scenes: [
            {
              order: 1,
              title: 'Scene 1',
            },
          ],
        },
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-20T00:01:00.000Z',
      },
    ]);

    const keys = Object.keys(rows[0]);
    assert.deepEqual(keys.slice(-9), [
      '来源类型',
      '状态',
      '错误信息',
      '创建时间',
      '更新时间',
      '整体总结',
      '视频类型',
      '目标人群',
      '卖点汇总',
    ]);
  });
});
