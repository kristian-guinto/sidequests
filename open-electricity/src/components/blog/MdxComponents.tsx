import React from "react";
import Link from "next/link";
import { BlogEnergyChart } from "./BlogEnergyChart";
import { BlogCustomChart } from "./BlogCustomChart";
import { StatCallout, DataCallout, GridBadge } from "./BlogCallouts";

export const mdxComponents = {
  // Custom blog widgets
  BlogEnergyChart,
  BlogCustomChart,
  StatCallout,
  DataCallout,
  GridBadge,

  // Standard markdown enhancements
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const isInternal = href && (href.startsWith("/") || href.startsWith("#"));
    if (isInternal) {
      return (
        <Link
          href={href}
          className="text-emerald-600 dark:text-emerald-400 font-medium underline underline-offset-4 hover:text-emerald-500 transition-colors"
          {...props}
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-600 dark:text-emerald-400 font-medium underline underline-offset-4 hover:text-emerald-500 transition-colors"
        {...props}
      >
        {children}
      </a>
    );
  },
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="p-4 rounded-xl bg-neutral-900 dark:bg-neutral-950 text-neutral-100 overflow-x-auto text-xs sm:text-sm font-mono border border-neutral-800 my-6 shadow-sm"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code
      className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-mono border border-neutral-200 dark:border-neutral-700"
      {...props}
    >
      {children}
    </code>
  ),
  table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-6 border border-neutral-200 dark:border-neutral-800 rounded-xl">
      <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800 text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="px-4 py-3 bg-neutral-50 dark:bg-neutral-900 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td
      className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 dark:text-neutral-200 border-t border-neutral-100 dark:border-neutral-800/60"
      {...props}
    >
      {children}
    </td>
  ),
};
