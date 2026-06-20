'use client';

import { Card, CardContent } from "@/components/ui/card";
import React from "react";

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex w-full items-center justify-center p-12">
      <div className="flex flex-col items-center text-center max-w-sm">
        <div className="mb-6">{icon}</div>
        <h2 className="font-headline text-2xl font-bold mb-2">{title}</h2>
        <p className="text-muted-foreground mb-6">{description}</p>
        {action}
      </div>
    </Card>
  );
}
