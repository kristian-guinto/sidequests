import React from "react";

export function ChartCard({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-neutral-200/80 bg-white text-neutral-950 shadow-sm transition-all hover:shadow-md ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function ChartCardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col space-y-1 p-4 sm:p-5 pb-2 border-b border-neutral-100/80 bg-neutral-50/20 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function ChartCardTitle({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <div
      className={`flex items-center justify-between font-semibold leading-none tracking-tight text-sm sm:text-base text-neutral-900 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function ChartCardDescription({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-neutral-500 font-normal ${className}`} {...props}>
      {children}
    </p>
  );
}

export function ChartCardContent({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-2 sm:p-3 pt-2 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function ChartCardFooter({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center justify-between px-4 sm:px-5 py-2.5 text-xs text-neutral-500 border-t border-neutral-100 bg-neutral-50/30 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
