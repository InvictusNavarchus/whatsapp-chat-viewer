import { Skeleton } from '@/components/ui/skeleton';

export const ChatListSkeleton = () => {
  return (
    <div className="space-y-3">
      {/* Bookmarks skeleton */}
      <div className="p-3 rounded-lg border">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-6 ml-auto" />
        </div>
      </div>
      
      {/* Chat items skeleton */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
};