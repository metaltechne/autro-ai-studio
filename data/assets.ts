export const AUTRO_LOGO_URL = 'https://cdn.awsli.com.br/400x300/2743/2743515/logo/autro-id-visual---png--01-pfq472hym3.png';

// Helper to fetch the logo and convert to Base64 for PDF embedding
export const getLogoBase64ForPdf = async (): Promise<string> => {
    // Simple caching mechanism to avoid re-fetching during the same session
    if ((window as any).autroLogoBase64) {
        return (window as any).autroLogoBase64;
    }
    try {
        const response = await fetch(AUTRO_LOGO_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        
        const base64 = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }
                // Fill the background with white
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // Draw the image on top
                ctx.drawImage(img, 0, 0);
                // Get the data URL as a JPEG to ensure no transparency
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                URL.revokeObjectURL(img.src); // Clean up blob URL
                resolve(dataUrl);
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(img.src);
                reject(err);
            };
            img.src = URL.createObjectURL(blob);
        });

        (window as any).autroLogoBase64 = base64; // Cache it
        return base64;
    } catch (error) {
        console.error("Failed to fetch or convert logo:", error);
        throw error;
    }
};