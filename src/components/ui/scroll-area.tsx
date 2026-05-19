"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// 简化版 ScrollArea，使用原生 CSS 滚动
// 这是为了规避 @radix-ui/react-scroll-area 与 React 19 的兼容性问题
// 参考: https://github.com/radix-ui/primitives/issues/2882

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  type?: "auto" | "always" | "scroll" | "hover"
}

function ScrollArea({
  className,
  children,
  type = "hover",
  ...props
}: ScrollAreaProps) {
  return (
    <div
      data-slot="scroll-area"
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div
        data-slot="scroll-area-viewport"
        className={cn(
          "h-full w-full rounded-[inherit]",
          type === "always" && "[scrollbar-width:thin]",
          type === "hover" && "[scrollbar-width:thin] hover:[scrollbar-width:auto]",
          "[&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar]:h-2.5",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full",
          "[&::-webkit-scrollbar-thumb]:border-l-transparent",
          "overflow-auto"
        )}
      >
        {children}
      </div>
    </div>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "vertical" | "horizontal"
}) {
  // 简化版 ScrollBar，仅用于兼容性，不实际渲染
  // 滚动条样式已在 ScrollArea 中通过 CSS 处理
  return null
}

export { ScrollArea, ScrollBar }
