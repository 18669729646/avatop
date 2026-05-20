import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const pageSource = readSource('src/app/analysis-master/page.tsx');
assert.match(pageSource, /Excel 批量导入/, '分析大师页应包含 Excel 批量导入入口');
assert.match(pageSource, /导出结果|导出/, '分析大师页应包含导出入口');
assert.match(pageSource, /分镜细节/, '分析大师页应展示分镜细节');

const analyzeRouteSource = readSource('src/app/api/analysis-master/analyze/[id]/route.ts');
assert.match(analyzeRouteSource, /enqueueAnalysisTaskForProject/, '单项分析接口应复用分析入队 helper');

const projectsRouteSource = readSource('src/app/api/analysis-master/projects/route.ts');
assert.match(projectsRouteSource, /createAnalysisProjectFromLink/, '项目创建接口应复用共享创建 helper');

console.log('analysis-master main architecture assertions passed');
