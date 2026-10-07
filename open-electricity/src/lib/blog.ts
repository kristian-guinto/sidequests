import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { CountryCode } from "./types";

const POSTS_DIRECTORY = path.join(process.cwd(), "src/content/blog");

export interface Author {
  name: string;
  role?: string;
  avatar?: string;
}

export interface BlogPostMeta {
  title: string;
  slug: string;
  date: string;
  description: string;
  country?: CountryCode;
  author: Author;
  tags: string[];
  readingTime: string;
  featured?: boolean;
  published?: boolean;
  heroImage?: string;
}

export interface BlogPost {
  meta: BlogPostMeta;
  content: string;
}

/**
 * Calculates estimated reading time based on 200 words per minute.
 */
function calculateReadingTime(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

/**
 * Ensures the content directory exists.
 */
function ensureContentDirectory() {
  if (!fs.existsSync(POSTS_DIRECTORY)) {
    fs.mkdirSync(POSTS_DIRECTORY, { recursive: true });
  }
}

/**
 * Get all published blog posts sorted by date descending.
 */
export function getAllPosts(): BlogPostMeta[] {
  ensureContentDirectory();

  const fileNames = fs.readdirSync(POSTS_DIRECTORY);
  const allPosts: BlogPostMeta[] = [];

  for (const fileName of fileNames) {
    if (!fileName.endsWith(".mdx") && !fileName.endsWith(".md")) {
      continue;
    }

    const slug = fileName.replace(/\.mdx?$/, "");
    const fullPath = path.join(POSTS_DIRECTORY, fileName);
    const fileContents = fs.readFileSync(fullPath, "utf8");

    const { data, content } = matter(fileContents);

    // In production, skip unpublished posts (published === false)
    const isPublished = data.published !== false;
    if (process.env.NODE_ENV === "production" && !isPublished) {
      continue;
    }

    allPosts.push({
      title: data.title || "Untitled Post",
      slug: data.slug || slug,
      date: data.date ? new Date(data.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      description: data.description || "",
      country: data.country || undefined,
      author: {
        name: data.author?.name || "OpenElectricity Team",
        role: data.author?.role || "Grid Analyst",
        avatar: data.author?.avatar,
      },
      tags: Array.isArray(data.tags) ? data.tags : [],
      readingTime: data.readingTime || calculateReadingTime(content),
      featured: Boolean(data.featured),
      published: isPublished,
      heroImage: data.heroImage,
    });
  }

  // Sort descending by date
  return allPosts.sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()));
}

/**
 * Get a specific blog post by slug.
 */
export function getPostBySlug(slug: string): BlogPost | null {
  ensureContentDirectory();

  const mdxPath = path.join(POSTS_DIRECTORY, `${slug}.mdx`);
  const mdPath = path.join(POSTS_DIRECTORY, `${slug}.md`);

  let targetPath = "";
  if (fs.existsSync(mdxPath)) {
    targetPath = mdxPath;
  } else if (fs.existsSync(mdPath)) {
    targetPath = mdPath;
  } else {
    return null;
  }

  const fileContents = fs.readFileSync(targetPath, "utf8");
  const { data, content } = matter(fileContents);

  return {
    meta: {
      title: data.title || "Untitled Post",
      slug,
      date: data.date ? new Date(data.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      description: data.description || "",
      country: data.country || undefined,
      author: {
        name: data.author?.name || "OpenElectricity Team",
        role: data.author?.role || "Grid Analyst",
        avatar: data.author?.avatar,
      },
      tags: Array.isArray(data.tags) ? data.tags : [],
      readingTime: data.readingTime || calculateReadingTime(content),
      featured: Boolean(data.featured),
      published: data.published !== false,
      heroImage: data.heroImage,
    },
    content,
  };
}

/**
 * Get list of all distinct tags across all blog posts.
 */
export function getAllTags(): string[] {
  const posts = getAllPosts();
  const tagsSet = new Set<string>();
  posts.forEach((p) => p.tags.forEach((t) => tagsSet.add(t)));
  return Array.from(tagsSet).sort();
}

/**
 * Get list of all distinct countries mentioned in blog posts.
 */
export function getAllCountries(): CountryCode[] {
  const posts = getAllPosts();
  const countriesSet = new Set<CountryCode>();
  posts.forEach((p) => {
    if (p.country) countriesSet.add(p.country);
  });
  return Array.from(countriesSet);
}

