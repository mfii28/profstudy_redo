import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function CourseCardSkeleton() {
  return (
    <Card className="h-full flex flex-col overflow-hidden rounded-lg shadow-sm">
      <CardHeader className="p-0">
        <Skeleton className="aspect-video w-full" />
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-3 w-1/2" />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-1 mt-1">
            <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4 pt-0">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-8 w-1/3" />
      </CardFooter>
    </Card>
  )
}


export function CourseListSkeleton() {
    return (
        <Card className="flex flex-col overflow-hidden rounded-lg shadow-sm md:flex-row">
            <Skeleton className="relative h-48 w-full flex-shrink-0 md:h-auto md:w-64" />
            <div className="flex flex-1 flex-col p-6">
                <div className="flex-1">
                    <Skeleton className="h-5 w-20 mb-2" />
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/4 mb-4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6 mt-2" />
                </div>
                <div className="mt-auto flex items-center justify-between gap-4 pt-4">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-24" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                </div>
            </div>
        </Card>
    )
}
