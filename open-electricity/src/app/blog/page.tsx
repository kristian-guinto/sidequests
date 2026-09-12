import React from "react";
import Link from "next/link";
import { getAllPosts, getAllTags, getAllCountries } from "@/lib/blog";
import { COUNTRIES_METADATA, CountryCode } from "@/lib/types";
import {
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Zap,
  BarChart3,
  Bookmark,
  ChevronRight,
  Layers,
} from "lucide-react";

export const metadata = {
  title: "Insights & Findings | OpenElectricity",
  description:
    "Engineering notes, grid transition dynamics, renewable curtailment analysis, and spot market discoveries across Southeast Asian electricity grids.",
};

export default function BlogIndexPage({
  searchParams,
}: {
  searchParams?: { country?: string; tag?: string };
}) {
  const allPosts = getAllPosts();
  const allTags = getAllTags();
  const allCountries = getAllCountries();

  const selectedCountry = searchParams?.country as CountryCode | undefined;
  const selectedTag = searchParams?.tag;

  const filteredPosts = allPosts.filter((post) => {
    if (selectedCountry && post.country !== selectedCountry) {
      return false;
    }
    if (selectedTag && !post.tags.includes(selectedTag)) {
      return false;
    }
    return true;
  });

  const featuredPost = allPosts.find((p) => p.featured) || allPosts[0];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Top Breadcrumb & Back Bar */}
      <nav className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-[#0d0d10]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-sm">
            <Link
              href="/"
              className="font-extrabold text-neutral-950 dark:text-white flex items-center gap-1.5 hover:opacity-80 transition"
            >
              <div className="h-6 w-6 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white">
                <Zap className="h-3.5 w-3.5 fill-white" />
              </div>
              <span>
                Open<span className="text-emerald-600 dark:text-emerald-400">Electricity</span>
              </span>
            </Link>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
            <span className="font-semibold text-neutral-600 dark:text-neutral-400">
              Insights & Notes
            </span>
          </div>

          <Link
            href="/"
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Live Grid Tracker</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header Hero */}
        <header className="mb-12">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Engineering & Grid Telemetry Notes</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
            OpenElectricity Insights
          </h1>
          <p className="mt-3 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl leading-relaxed">
            Documenting real-world electricity grid quirks, fuel transition shifts, wholesale spot
            market anomalies, and data engineering learnings from Southeast Asian power systems.
          </p>
        </header>

        {/* Featured Post Card */}
        {featuredPost && !selectedCountry && !selectedTag && (
          <section className="mb-14">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-4 flex items-center gap-2">
              <Bookmark className="h-3.5 w-3.5 text-emerald-500" />
              Featured Deep Dive
            </h2>
            <Link
              href={`/blog/${featuredPost.slug}`}
              className="block group rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 sm:p-8 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 hover:shadow-lg transition-all"
            >
              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                {featuredPost.country && COUNTRIES_METADATA[featuredPost.country] && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 font-semibold text-neutral-700 dark:text-neutral-300">
                    <span>{COUNTRIES_METADATA[featuredPost.country].flag}</span>
                    <span>{COUNTRIES_METADATA[featuredPost.country].name}</span>
                  </span>
                )}
                <span className="text-neutral-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {featuredPost.date}
                </span>
                <span className="text-neutral-400 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {featuredPost.readingTime}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {featuredPost.title}
              </h3>

              <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-300 line-clamp-3 leading-relaxed">
                {featuredPost.description}
              </p>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800/80">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    {featuredPost.author.name.charAt(0)}
                  </div>
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    {featuredPost.author.name}
                  </span>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Read Article
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          </section>
        )}

        {/* Filter Toolbar: Countries & Tags */}
        <section className="mb-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-2 flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              Country:
            </span>
            <Link
              href="/blog"
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${!selectedCountry
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold"
                  : "bg-white dark:bg-[#121216] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800"
                }`}
            >
              All Regions
            </Link>
            {allCountries.map((cCode) => {
              const meta = COUNTRIES_METADATA[cCode];
              if (!meta) return null;
              const isSelected = selectedCountry === cCode;
              return (
                <Link
                  key={cCode}
                  href={`/blog?country=${cCode}${selectedTag ? `&tag=${selectedTag}` : ""}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition ${isSelected
                      ? "bg-emerald-600 text-white font-bold shadow-xs"
                      : "bg-white dark:bg-[#121216] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800"
                    }`}
                >
                  <span>{meta.flag}</span>
                  <span>{meta.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Tag Filter Pills */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-2">
                Tags:
              </span>
              {allTags.map((tag) => {
                const isSelected = selectedTag === tag;
                return (
                  <Link
                    key={tag}
                    href={
                      isSelected
                        ? `/blog${selectedCountry ? `?country=${selectedCountry}` : ""}`
                        : `/blog?tag=${encodeURIComponent(tag)}${selectedCountry ? `&country=${selectedCountry}` : ""
                        }`
                    }
                    className={`px-2.5 py-0.5 rounded-md text-xs transition ${isSelected
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      }`}
                  >
                    #{tag}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Post Grid */}
        <section>
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#121216] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8">
              <BarChart3 className="h-8 w-8 text-neutral-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
                No articles found
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Try selecting a different filter or reset filters.
              </p>
              <Link
                href="/blog"
                className="mt-4 inline-block text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Clear all filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => {
                const countryMeta = post.country ? COUNTRIES_METADATA[post.country] : null;
                return (
                  <article
                    key={post.slug}
                    className="flex flex-col justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-5 hover:border-emerald-500/40 hover:shadow-md transition group"
                  >
                    <div>
                      {/* Meta badges */}
                      <div className="flex items-center justify-between text-xs text-neutral-400 mb-3">
                        <div className="flex items-center gap-2">
                          {countryMeta && (
                            <span className="inline-flex items-center gap-1 font-semibold text-neutral-700 dark:text-neutral-300">
                              <span>{countryMeta.flag}</span>
                              <span>{countryMeta.code}</span>
                            </span>
                          )}
                          <span>{post.date}</span>
                        </div>
                        <span>{post.readingTime}</span>
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-bold text-neutral-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                        <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                      </h3>

                      {/* Excerpt */}
                      <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed">
                        {post.description}
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {post.tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>

                      <Link
                        href={`/blog/${post.slug}`}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                      >
                        Read
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

