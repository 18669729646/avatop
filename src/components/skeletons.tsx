import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * 图片卡片骨架屏
 */
export function ImageCardSkeleton() {
  return (
    <div className="aspect-square rounded-lg overflow-hidden">
      <Skeleton className="w-full h-full" />
    </div>
  );
}

/**
 * 图片网格骨架屏
 */
export function ImageGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array(count).fill(0).map((_, i) => (
        <ImageCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 产品卡片骨架屏
 */
export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-3">
        <Skeleton className="w-20 h-20 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    </Card>
  );
}

/**
 * 产品列表骨架屏
 */
export function ProductListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Array(count).fill(0).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 任务卡片骨架屏
 */
export function TaskCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 任务列表骨架屏
 */
export function TaskListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array(count).fill(0).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 表格行骨架屏
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr>
      {Array(columns).fill(0).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * 表格骨架屏
 */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-md border">
      <table className="w-full">
        <tbody>
          {Array(rows).fill(0).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 模板卡片骨架屏
 */
export function TemplateCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video">
        <Skeleton className="w-full h-full" />
      </div>
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 模板网格骨架屏
 */
export function TemplateGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array(count).fill(0).map((_, i) => (
        <TemplateCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 角色卡片骨架屏
 */
export function CharacterCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square">
        <Skeleton className="w-full h-full" />
      </div>
      <CardContent className="p-2">
        <Skeleton className="h-4 w-3/4 mx-auto" />
      </CardContent>
    </Card>
  );
}

/**
 * 角色网格骨架屏
 */
export function CharacterGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array(count).fill(0).map((_, i) => (
        <CharacterCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 详情页骨架屏
 */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="aspect-video rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * 通用列表项骨架屏
 */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Skeleton className="w-12 h-12 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

/**
 * 通用列表骨架屏
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="border rounded-lg">
      {Array(count).fill(0).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}
