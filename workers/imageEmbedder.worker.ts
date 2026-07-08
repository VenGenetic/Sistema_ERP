import { env, RawImage, AutoProcessor, CLIPVisionModelWithProjection } from '@huggingface/transformers';

// Configure transformers env
env.allowLocalModels = false;

let processor: any = null;
let visionModel: any = null;

async function getModel() {
    if (!processor || !visionModel) {
        self.postMessage({ status: 'loading', message: 'Cargando modelo de inteligencia artificial...' });
        processor = await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32');
        visionModel = await CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32');
        self.postMessage({ status: 'ready', message: 'Modelo cargado y listo' });
    }
    return { processor, visionModel };
}

self.onmessage = async (event: MessageEvent) => {
    const { action, imageBuffer, imageUrl } = event.data;

    if (action === 'embed') {
        try {
            const { processor, visionModel } = await getModel();

            self.postMessage({ status: 'processing', message: 'Analizando imagen...' });

            let rawImage;
            if (imageUrl) {
                rawImage = await RawImage.read(imageUrl);
            } else if (imageBuffer) {
                const blob = new Blob([imageBuffer]);
                const objectUrl = URL.createObjectURL(blob);
                rawImage = await RawImage.read(objectUrl);
                URL.revokeObjectURL(objectUrl);
            } else {
                throw new Error('No image source provided');
            }

            const imageInputs = await processor(rawImage);
            const { image_embeds } = await visionModel(imageInputs);
            const embedding = Array.from(image_embeds.data);

            self.postMessage({ status: 'success', embedding });
        } catch (error: any) {
            console.error('Error generating embedding in worker:', error);
            self.postMessage({ status: 'error', error: error.message });
        }
    }
};
