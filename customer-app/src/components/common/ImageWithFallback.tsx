import { useState, type ImgHTMLAttributes } from 'react';

interface ImageWithFallbackProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc: string;
}

export const ImageWithFallback = ({
  src,
  fallbackSrc,
  alt = '',
  className = '',
  ...props
}: ImageWithFallbackProps) => {
  const [failed, setFailed] = useState(false);
  const effectiveSrc = !failed && src ? src : fallbackSrc;

  return (
    <img
      {...props}
      src={effectiveSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (!failed) {
          setFailed(true);
        }
      }}
    />
  );
};
