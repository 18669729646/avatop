import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
  }

  const userId = authResult.userId;
  const isAdmin = authResult.payload.role === 'admin';

  try {
    const body = await request.json();
    const { scriptId } = body;

    if (!scriptId) {
      return NextResponse.json({ success: false, error: '请提供脚本ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    const { data: remakeData, error: remakeError } = await client
      .from('analysis_master_script_remakes')
      .select('*')
      .eq('id', scriptId)
      .single();

    if (remakeError || !remakeData) {
      return NextResponse.json({ success: false, error: '脚本不存在或无权限访问' }, { status: 404 });
    }

    if (!isAdmin && remakeData.user_id !== userId) {
      return NextResponse.json({ success: false, error: '脚本不存在或无权限访问' }, { status: 403 });
    }

    const { data: projectData } = await client
      .from('analysis_master_projects')
      .select('name, source_url, video_url')
      .eq('id', remakeData.project_id)
      .single();

    const projectName = projectData?.name || '未命名项目';
    const sourceUrl = projectData?.source_url || '';
    const videoUrl = projectData?.video_url || '';

    const productSnapshot = remakeData.product_snapshot as Record<string, unknown> || {};
    const productName = String(productSnapshot.name || '');
    const productDescription = String(productSnapshot.description || '');
    const productSellingPoints = Array.isArray(productSnapshot.sellingPoints)
      ? productSnapshot.sellingPoints.join('、')
      : '';

    const segments = Array.isArray(remakeData.segments) ? remakeData.segments : [];
    const rows: Record<string, string>[] = [];

    const baseRow = {
      项目名称: projectName,
      原视频URL: videoUrl || sourceUrl,
      产品名称: productName,
      产品描述: productDescription,
      产品卖点: productSellingPoints,
      脚本标题: remakeData.title || '',
      开头钩子: remakeData.hook || '',
      痛点场景: remakeData.pain_point || '',
      卖点脚本: remakeData.selling_point_script || '',
      CTA: remakeData.cta || '',
      完整口播: remakeData.full_script || '',
      完整口播_中文: remakeData.full_script_cn || '',
      拍摄建议: remakeData.shooting_notes || '',
      视觉展示建议: remakeData.visual_notes || '',
      合规注意: remakeData.compliance_notes || '',
      创建时间: remakeData.created_at || '',
    };

    if (segments.length > 0) {
      for (const seg of segments) {
        rows.push({
          ...baseRow,
          场景序号: String(typeof seg.order === 'number' ? seg.order : 0),
          场景时长秒: String(typeof seg.durationSec === 'number' ? seg.durationSec : 0),
          画面内容: String(seg.scene || ''),
          口播内容: String(seg.voiceover || ''),
          口播内容_中文: String(seg.voiceoverCn || seg.voiceover_cn || ''),
          动作调度: String(seg.action || ''),
          产品露出: String(seg.productPlacement || ''),
          镜头建议: String(seg.camera || ''),
          屏幕文字: String(seg.onScreenText || ''),
          屏幕文字_中文: String(seg.onScreenTextCn || seg.onScreenText_cn || ''),
        });
      }
    } else {
      rows.push({
        ...baseRow,
        场景序号: '',
        场景时长秒: '',
        画面内容: '',
        口播内容: '',
        口播内容_中文: '',
        动作调度: '',
        产品露出: '',
        镜头建议: '',
        屏幕文字: '',
        屏幕文字_中文: '',
      });
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 25 }, // 项目名称
      { wch: 50 }, // 原视频URL
      { wch: 25 }, // 产品名称
      { wch: 40 }, // 产品描述
      { wch: 40 }, // 产品卖点
      { wch: 25 }, // 脚本标题
      { wch: 40 }, // 开头钩子
      { wch: 40 }, // 痛点场景
      { wch: 40 }, // 卖点脚本
      { wch: 40 }, // CTA
      { wch: 80 }, // 完整口播
      { wch: 80 }, // 完整口播_中文
      { wch: 10 }, // 场景序号
      { wch: 12 }, // 场景时长秒
      { wch: 40 }, // 画面内容
      { wch: 40 }, // 口播内容
      { wch: 40 }, // 口播内容_中文
      { wch: 30 }, // 动作调度
      { wch: 30 }, // 产品露出
      { wch: 30 }, // 镜头建议
      { wch: 30 }, // 屏幕文字
      { wch: 30 }, // 屏幕文字_中文
      { wch: 40 }, // 拍摄建议
      { wch: 40 }, // 视觉展示建议
      { wch: 40 }, // 合规注意
      { wch: 20 }, // 创建时间
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, '脚本复刻');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `script-remake-${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error(`[Script Remake Export API] 导出失败: ${(error as Error).message}`, { userId });
    return NextResponse.json({ success: false, error: '导出失败' }, { status: 500 });
  }
}
