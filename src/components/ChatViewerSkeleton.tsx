import { Skeleton } from '@/components/ui/skeleton';
import log from 'loglevel';

const logger = log.getLogger('chatViewerSkeleton');
logger.setLevel('debug');

export const ChatViewerSkeleton = () => {
  return (
    <div className="h-full flex flex-col">
      {/* Header skeleton */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      
      {/* Messages skeleton */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`flex ${i % 3 === 0 ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs space-y-2 p-3 rounded-lg ${
              i % 3 === 0 ? 'bg-primary/10' : 'bg-muted'
            }`}>
              <Skeleton className="h-4 w-full" />
              {Math.random() > 0.5 && <Skeleton className="h-4 w-3/4" />}
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};