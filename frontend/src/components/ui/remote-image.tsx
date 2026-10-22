/* eslint-disable @next/next/no-img-element -- Every URL this component renders is user
   content: an avatar or background the user picked, either a file under /uploads or an
   arbitrary http(s) link pasted into their profile. next/image would have to proxy those
   hosts through the optimizer, which is why a plain <img> is the honest choice here. */
import { cn } from '@/lib/utils'

interface RemoteImageProps {
  src?: string | null
  alt?: string
  className?: string
}

/** An avatar or backdrop whose URL comes from user data, sized by its parent. */
export function RemoteImage({ src, alt = '', className }: RemoteImageProps) {
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn('h-full w-full object-cover', className)}
    />
  )
}
