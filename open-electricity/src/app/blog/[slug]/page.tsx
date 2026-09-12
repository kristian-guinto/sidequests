import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { COUNTRIES_METADATA } from "@/lib/types";
import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxComponents } from "@/components/blog/MdxComponents";
import { BlogShareButton } from "@/components/blog/BlogShareButton";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
  Tag,
  ArrowLeft,
} from "lucide-react";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = getPostBySlug(params.slug);
  if (!post) return { title: "Post Not Found" };

  return {
    title: `${post.meta.title} | OpenElectricity Insights`,
    description: post.meta.description,
    keywords: post.meta.tags,
    openGraph: {
      title: post.meta.title,
      description: post.meta.description,
      type: "article",
      publishedTime: post.meta.date,
    },
  };
}

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const { meta, content } = post;
  const countryMeta = meta.country ? COUNTRIES_METADATA[meta.country] : null;

  // Find next/prev posts
  const allPosts = getAllPosts();
  const currentIndex = allPosts.findIndex((p) => p.slug === meta.slug);
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Top Navbar */}
      <nav className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-[#0d0d10]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs sm:text-sm">
            <Link
              href="/"
              className="font-extrabold text-neutral-950 dark:text-white flex items-center gap-1.5 hover:opacity-80 transition"
            >
              <div className="h-6 w-6 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white">
                <Zap className="h-3.5 w-3.5 fill-white" />
              </div>
              <span className="hidden sm:inline">
                Open<span className="text-emerald-600 dark:text-emerald-400">Electricity</span>
              </span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
            <Link
              href="/blog"
              className="text-neutral-600 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium transition"
            >
              Insights
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-neutral-400 truncate max-w-[150px] sm:max-w-[280px]">
              {meta.title}
            </span>
          </div>

          <BlogShareButton title={meta.title} />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Back Link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Insights & Articles</span>
        </Link>

        {/* Article Header */}
        <header className="mb-10 pb-8 border-b border-neutral-200 dark:border-neutral-800">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            {countryMeta && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/20">
                <span>{countryMeta.flag}</span>
                <span>{countryMeta.name}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {meta.date}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {meta.readingTime}
            </span>
          </div>

          {/* Article Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-neutral-950 dark:text-white leading-[1.15]">
            {meta.title}
          </h1>

          {/* Subtitle / Excerpt */}
          {meta.description && (
            <p className="mt-4 text-base sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {meta.description}
            </p>
          )}

          {/* Author & Tags */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-neutral-100 dark:border-neutral-800/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                {meta.author.name.charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                  {meta.author.name}
                </div>
                {meta.author.role && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {meta.author.role}
                  </div>
                )}
              </div>
            </div>

            {meta.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                  >
                    <Tag className="h-2.5 w-2.5 opacity-60" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* MDX Body Content */}
        <article className="prose prose-neutral dark:prose-invert max-w-none text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans text-base sm:text-[17px] prose-headings:tracking-tight prose-headings:font-bold prose-h2:text-2xl sm:prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-p:my-4 prose-p:leading-relaxed">
          <MDXRemote source={content} components={mdxComponents} />
        </article>

        {/* Article Footer & Navigation */}
        <footer className="mt-14 pt-8 border-t border-neutral-200 dark:border-neutral-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prevPost ? (
              <Link
                href={`/blog/${prevPost.slug}`}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] hover:border-emerald-500/40 transition group text-left"
              >
                <div className="text-xs text-neutral-400 flex items-center gap-1 mb-1">
                  <ChevronLeft className="h-3 w-3" />
                  <span>Previous Article</span>
                </div>
                <div className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                  {prevPost.title}
                </div>
              </Link>
            ) : <div />}

            {nextPost ? (
              <Link
                href={`/blog/${nextPost.slug}`}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] hover:border-emerald-500/40 transition group text-right"
              >
                <div className="text-xs text-neutral-400 flex items-center justify-end gap-1 mb-1">
                  <span>Next Article</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
                <div className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                  {nextPost.title}
                </div>
              </Link>
            ) : <div />}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <span>Back to all Insights</span>
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

