type AnyFunction = (...args: unknown[]) => unknown;

export function debounce<T extends AnyFunction>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return function(this: unknown, ...args: Parameters<T>) {
        if (timeout) {
            clearTimeout(timeout);
        }
        
        timeout = setTimeout(() => {
            func.apply(this, args);
            timeout = null;
        }, wait);
    };
} 