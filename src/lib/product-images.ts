import { createClient } from "@/lib/supabase/client";
import { PRODUCT_IMAGES_BUCKET, productImagePath } from "@/lib/storage-path";

export async function uploadProductImage(productId: string, file: File) {
  const supabase = createClient();
  const path = productImagePath(productId, file.name);
  const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, { upsert: true });
  if (uploadError) return { error: uploadError.message, path: null as string | null };

  const { error: updateError } = await supabase.from("products").update({ image_url: path }).eq("id", productId);
  if (updateError) return { error: updateError.message, path: null };

  return { error: null, path };
}

export async function signedProductImageUrl(path: string, expiresIn = 3600) {
  const result = await createClient().storage.from(PRODUCT_IMAGES_BUCKET).createSignedUrl(path, expiresIn);
  if (result.error) return null;
  return result.data.signedUrl;
}

export async function signedProductImageUrls(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (path) => [path, await signedProductImageUrl(path)] as const)
  );
  return new Map(entries.filter(([, url]) => url).map(([path, url]) => [path, url!]));
}
