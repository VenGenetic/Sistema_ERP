/**
 * Determina si un producto está descontinuado (sea permanente o temporal activo).
 */
export const isProductDiscontinued = (product: any): boolean => {
    if (!product || !product.is_discontinued) return false;
    
    if (product.discontinued_until) {
        return new Date(product.discontinued_until) > new Date();
    }
    
    return true;
};
