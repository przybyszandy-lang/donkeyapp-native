// User uploads of memes and videos.
// Files go to u/<user id>/ in the memes / videos buckets (the only place users may add files),
// then submit_upload() creates the post: pending (checked by Andy) or published (trusted uploaders).
import { decode } from "base64-arraybuffer";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export type UploadType = "meme" | "video";

export const MAX_DESCRIPTION = 100;
export const MAX_VIDEO_SECONDS = 90;
const MAX_MEME_BYTES = 5 * 1024 * 1024; // memes bucket limit
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // videos bucket limit (needs Supabase Pro)
const MEME_MAX_WIDTH = 1440;
const POSTER_WIDTH = 720;

export type PreparedMeme = {
  type: "meme";
  previewUri: string;
  base64: string;
  width: number;
  height: number;
};

export type PreparedVideo = {
  type: "video";
  uri: string;
  posterUri: string;
  posterBase64: string;
  width: number;
  height: number;
  seconds: number;
};

export type PreparedUpload = PreparedMeme | PreparedVideo;

// Friendly message for anything that goes wrong.
export function uploadErrorMessage(e: any): string {
  const text = String(e?.message ?? e ?? "");
  if (/exceeded the maximum allowed size|payload too large|413/i.test(text)) {
    return "This file is too large. Please choose a smaller one.";
  }
  if (/row-level security|not authorized|unauthorized|403/i.test(text)) {
    return "Uploads are not available for this account. Please contact us.";
  }
  if (/network request failed|failed to fetch/i.test(text)) {
    return "No connection. Please check your internet and try again.";
  }
  return text || "Something went wrong. Please try again.";
}

async function askPermission(source: "camera" | "library", type: UploadType) {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    const what = type === "meme" ? "pictures" : "videos";
    throw new Error(
      source === "camera"
        ? "Please allow camera access in your phone settings."
        : `Please allow access to your ${what} in your phone settings.`
    );
  }
}

// Shrinks a picture to a sensible size and returns it as JPEG text ready to upload.
async function toJpeg(uri: string, maxWidth: number, width: number, compress: number) {
  const context = ImageManipulator.manipulate(uri);
  if (width > maxWidth) context.resize({ width: maxWidth });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  if (!saved.base64) throw new Error("Could not prepare the picture.");
  return saved;
}

// Lets the person choose (or take) a meme picture. Returns null if they cancelled.
export async function pickMeme(source: "camera" | "library"): Promise<PreparedMeme | null> {
  await askPermission(source, "meme");
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
  };
  const picked =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = picked.canceled ? null : picked.assets?.[0];
  if (!asset?.uri) return null;

  let saved = await toJpeg(asset.uri, MEME_MAX_WIDTH, asset.width || MEME_MAX_WIDTH + 1, 0.85);
  // base64 is about 4/3 of the real size
  if ((saved.base64!.length * 3) / 4 > MAX_MEME_BYTES) {
    saved = await toJpeg(asset.uri, 1080, asset.width || 1081, 0.6);
  }
  if ((saved.base64!.length * 3) / 4 > MAX_MEME_BYTES) {
    throw new Error("This picture is too large. Please choose a different one.");
  }
  return {
    type: "meme",
    previewUri: saved.uri,
    base64: saved.base64!,
    width: saved.width,
    height: saved.height,
  };
}

// Lets the person choose (or record) a video. iPhone shrinks it to 540p MP4 and lets them trim it
// to 90 seconds. Returns null if they cancelled.
export async function pickVideo(source: "camera" | "library"): Promise<PreparedVideo | null> {
  await askPermission(source, "video");
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["videos"],
    allowsEditing: Platform.OS === "ios",
    videoMaxDuration: MAX_VIDEO_SECONDS,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_960x540,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    quality: 1,
  };
  const picked =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = picked.canceled ? null : picked.assets?.[0];
  if (!asset?.uri) return null;

  // duration is in milliseconds
  const seconds = asset.duration ? asset.duration / 1000 : 0;
  if (seconds > MAX_VIDEO_SECONDS + 1) {
    throw new Error(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds long. Please trim it and try again.`);
  }
  if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
    throw new Error("This video is too large (max 100 MB). Please choose a shorter clip.");
  }
  const lowerName = (asset.fileName ?? asset.uri).toLowerCase();
  const mime = (asset.mimeType ?? "").toLowerCase();
  if (!(mime === "video/mp4" || lowerName.endsWith(".mp4") || lowerName.endsWith(".m4v"))) {
    throw new Error("This video format is not supported. Please choose an MP4 video.");
  }

  const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, {
    time: Math.min(1000, Math.max(0, (seconds * 1000) / 2)),
    quality: 0.9,
  });
  const poster = await toJpeg(thumb.uri, POSTER_WIDTH, thumb.width || POSTER_WIDTH + 1, 0.8);

  return {
    type: "video",
    uri: asset.uri,
    posterUri: poster.uri,
    posterBase64: poster.base64!,
    width: asset.width || thumb.width,
    height: asset.height || thumb.height,
    seconds,
  };
}

function newFileName(userId: string, extension: string, stamp: string) {
  return `u/${userId}/${stamp}.${extension}`;
}

// Uploads the file(s) and creates the post. Returns "pending" or "published".
export async function submitUpload(
  userId: string,
  prepared: PreparedUpload,
  description: string,
  language: string
): Promise<"pending" | "published"> {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let file: string;
  let poster: string | null = null;

  if (prepared.type === "meme") {
    file = newFileName(userId, "jpg", stamp);
    const { error } = await supabase.storage
      .from("memes")
      .upload(file, decode(prepared.base64), { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
  } else {
    const body = await fetch(prepared.uri).then((r) => r.arrayBuffer());
    if (body.byteLength > MAX_VIDEO_BYTES) {
      throw new Error("This video is too large (max 100 MB). Please choose a shorter clip.");
    }
    file = newFileName(userId, "mp4", stamp);
    const { error: videoError } = await supabase.storage
      .from("videos")
      .upload(file, body, { contentType: "video/mp4", upsert: false });
    if (videoError) throw videoError;

    poster = newFileName(userId, "jpg", stamp);
    const { error: posterError } = await supabase.storage
      .from("videos")
      .upload(poster, decode(prepared.posterBase64), { contentType: "image/jpeg", upsert: false });
    if (posterError) throw posterError;
  }

  const { data, error } = await supabase.rpc("submit_upload", {
    p_type: prepared.type,
    p_file: file,
    p_poster: poster,
    p_description: description.trim(),
    p_language: language,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return row?.status === "published" ? "published" : "pending";
}
