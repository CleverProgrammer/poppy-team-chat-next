'use client'

import { cn } from '../../utils/cn'

/**
 * SkeletonView - A container that maintains aspect ratio and shows a skeleton loader.
 * 
 * The aspect ratio is calculated from width/height props and CANNOT be changed.
 * The actual display size can be controlled by the parent via style or className.
 * 
 * Usage:
 * <SkeletonView width={1920} height={1080} loaded={imageLoaded}>
 *   <img src="..." onLoad={() => setImageLoaded(true)} />
 * </SkeletonView>
 * 
 * @param {number} width - Original media width (for aspect ratio calculation only)
 * @param {number} height - Original media height (for aspect ratio calculation only)
 * @param {boolean} loaded - Whether the content has loaded (hides skeleton when true)
 * @param {React.ReactNode} children - Content to render inside (image, video, etc.)
 * @param {string} className - Optional additional class name
 * @param {function} onClick - Optional click handler
 */
export default function SkeletonView({
  width,
  height,
  loaded = false,
  children,
  className,
  onClick,
}) {
  // Calculate aspect ratio from original dimensions
  const aspectRatio = width && height ? `${width} / ${height}` : undefined

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-xl',
        className
      )}
      style={{ aspectRatio }}
      onClick={onClick}
    >
      {/* Skeleton placeholder - visible until loaded */}
      {/* Uses semi-transparent white to adapt to any parent background */}
      {!loaded && (
        <div className='absolute inset-0 bg-white/10'>
          <div 
            className='absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent'
            style={{ animation: 'skeleton-shimmer 1.5s infinite' }}
          />
        </div>
      )}

      {/* Children (image, video, etc.) */}
      <div className={cn(
        'relative w-full h-full transition-opacity duration-200',
        loaded ? 'opacity-100' : 'opacity-0'
      )}>
        {children}
      </div>
    </div>
  )
}
