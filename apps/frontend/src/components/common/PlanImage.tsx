import React, { useState, useEffect } from "react";
import { Package } from "lucide-react";

interface PlanImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  showPlaceholder?: boolean;
}

/**
 * Componente de imagen para planes con manejo de errores y placeholder.
 */
const PlanImage: React.FC<PlanImageProps> = ({ src, alt, className, showPlaceholder = true }) => {
  const [error, setError] = useState(false);
  const placeholderUrl = "/logo.png"; // Usamos el logo como placeholder principal

  useEffect(() => {
    setError(false);
  }, [src]);

  if (!src && !showPlaceholder) return null;

  if (!src || error) {
    return (
      <div className={`${className} image-error-container`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <img 
          src={placeholderUrl} 
          alt="Placeholder" 
          className={className} 
          style={{ opacity: 0.5, filter: 'grayscale(1)' }} 
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
};

export default PlanImage;
