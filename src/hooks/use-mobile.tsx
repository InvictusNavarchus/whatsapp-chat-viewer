import * as React from "react"
import log from 'loglevel';
const logger = log.getLogger('useIsMobile');
logger.setLevel('debug');

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    logger.debug('📱 [HOOK] useIsMobile effect triggered')
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      logger.debug('📱 [HOOK] useIsMobile onChange, isMobile:', window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    logger.debug('📱 [HOOK] useIsMobile initial, isMobile:', window.innerWidth < MOBILE_BREAKPOINT)
    return () => {
      mql.removeEventListener("change", onChange)
      logger.debug('📱 [HOOK] useIsMobile cleanup')
    }
  }, [])

  return !!isMobile
}
