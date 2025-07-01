import { Progress } from '@/components/ui/progress';
import log from 'loglevel';

const logger = log.getLogger('parseProgress');
logger.setLevel('debug');

interface ParseProgressProps {
  progress: number;
  isVisible: boolean;
}

/**
 * Progress indicator for chat file parsing
 */
export const ParseProgress = ({ progress, isVisible }: ParseProgressProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg min-w-[300px]">
        <h3 className="text-lg font-semibold mb-4">Parsing Chat File...</h3>
        <Progress value={progress} className="mb-2" />
        <p className="text-sm text-gray-600 text-center">{progress}% complete</p>
      </div>
    </div>
  );
};
