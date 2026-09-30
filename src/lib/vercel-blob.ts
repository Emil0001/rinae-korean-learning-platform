const STORE_SPECIFIC_TOKEN_SUFFIX = "_READ_WRITE_TOKEN";

export function getBlobReadWriteToken() {
  const directToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (directToken) {
    return directToken;
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.endsWith(STORE_SPECIFIC_TOKEN_SUFFIX)) {
      continue;
    }

    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function hasBlobReadWriteToken() {
  return Boolean(getBlobReadWriteToken());
}
