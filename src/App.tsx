import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { setupDebugUtils } from "@/utils/debug";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import log from 'loglevel';

const queryClient = new QueryClient();
const logger = log.getLogger('app');
logger.setLevel('debug');

// Setup debug utilities in development
logger.info('🚀 [APP] Initializing WhatsApp Chat Viewer App...');
setupDebugUtils();
logger.info('🛠️ [APP] Debug utilities set up.');

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
