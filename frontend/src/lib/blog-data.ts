'use client';

import { getBlogPostsAction, saveBlogPostAction, removeBlogPostAction } from '@/app/actions/blog';
import type { BlogPost } from './db';

export const getBlogPosts = async (): Promise<BlogPost[]> => {
  return getBlogPostsAction();
};

export const saveBlogPost = async (post: Omit<BlogPost, 'id'> & { id?: string }): Promise<string> => {
  return saveBlogPostAction(post);
};

export const removeBlogPost = async (id: string): Promise<void> => {
  return removeBlogPostAction(id);
};

