'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bug, Info, TrendingUp, Users, Clock } from 'lucide-react';
import { authFetch } from '@/lib/auth-context';

interface LogStats {
  range: string;
  days: number;
  levelStats: {
    info: number;
    warn: number;
    error: number;
  };
  categoryStats: Array<{
    category: string;
    count: number;
  }>;
  trendData: Array<{
    time: string;
    info: number;
    warn: number;
    error: number;
  }>;
  topErrors: Array<{
    message: string;
    count: number;
    lastSeen: string;
  }>;
  userErrors: Array<{
    userId: string;
    count: number;
  }>;
  total: {
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    uniqueUsers: number;
  };
}

const COLORS = {
  info: '#3b82f6',
  warn: '#f59e0b',
  error: '#ef4444',
  category: [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
  ],
};

const CATEGORY_NAMES: Record<string, string> = {
  api: 'API请求',
  auth: '认证',
  payment: '支付',
  video: '视频处理',
  image: '图片处理',
  task: '任务队列',
  storage: '存储',
  credits: '积分',
  system: '系统',
};

export function LogVisualizations() {
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'1d' | '7d' | '30d'>('7d');

  useEffect(() => {
    fetchStats();
  }, [range]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await authFetch(`/api/admin/system-logs/stats?range=${range}`);
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      } else {
        console.error('获取日志统计失败:', result.error);
      }
    } catch (error) {
      console.error('获取日志统计失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-32" />
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // 准备趋势图表数据
  const trendChartData = stats.trendData.map(item => ({
    time: new Date(item.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    信息: item.info,
    警告: item.warn,
    错误: item.error,
  }));

  // 准备分类统计数据
  const categoryChartData = stats.categoryStats.map(item => ({
    name: CATEGORY_NAMES[item.category] || item.category,
    value: item.count,
  }));

  // 准备级别饼图数据
  const levelPieData = [
    { name: '信息', value: stats.total.infoCount },
    { name: '警告', value: stats.total.warnCount },
    { name: '错误', value: stats.total.errorCount },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* 统计概览卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总日志数</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.totalLogs.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              最近 {stats.days} 天
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">错误数</CardTitle>
            <Bug className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.total.errorCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              占比 {stats.total.totalLogs > 0 ? ((stats.total.errorCount / stats.total.totalLogs) * 100).toFixed(1) : '0'}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">警告数</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {stats.total.warnCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              占比 {stats.total.totalLogs > 0 ? ((stats.total.warnCount / stats.total.totalLogs) * 100).toFixed(1) : '0'}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">影响用户</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">
              唯一用户数
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 时间范围选择 */}
      <div className="flex gap-2">
        <Button
          variant={range === '1d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setRange('1d')}
        >
          最近 1 天
        </Button>
        <Button
          variant={range === '7d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setRange('7d')}
        >
          最近 7 天
        </Button>
        <Button
          variant={range === '30d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setRange('30d')}
        >
          最近 30 天
        </Button>
      </div>

      {/* 趋势图表 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>日志趋势</CardTitle>
            <CardDescription>按小时统计的日志数量变化趋势</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="信息"
                  stroke={COLORS.info}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="警告"
                  stroke={COLORS.warn}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="错误"
                  stroke={COLORS.error}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 日志级别分布 */}
        <Card>
          <CardHeader>
            <CardTitle>日志级别分布</CardTitle>
            <CardDescription>按日志级别统计</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={levelPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {levelPieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[entry.name === '信息' ? 'info' : entry.name === '警告' ? 'warn' : 'error']}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 错误分类统计 */}
        <Card>
          <CardHeader>
            <CardTitle>错误分类统计</CardTitle>
            <CardDescription>按错误类型统计</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 热门错误 */}
      <Card>
        <CardHeader>
          <CardTitle>热门错误</CardTitle>
          <CardDescription>出现频率最高的错误</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.topErrors.length > 0 ? (
              stats.topErrors.map((error, index) => (
                <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{error.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      最后出现: {new Date(error.lastSeen).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-destructive">
                      {error.count}
                    </span>
                    <p className="text-xs text-muted-foreground">次</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂无错误记录
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 用户错误统计 */}
      {stats.userErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>用户错误统计</CardTitle>
            <CardDescription>错误最多的用户</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.userErrors.map((user, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm font-mono">{user.userId}</span>
                  <span className="text-sm font-bold text-destructive">{user.count} 次</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
