const API_KEY_STORAGE_KEY = "chatweb_gemini_api_key";
const BACKEND_VALIDATE_KEY = "http://127.0.0.1:8000/validate-api-key";

function getExtensionStorage() {
	if (typeof browser !== "undefined" && browser.storage?.local) {
		return {
			get: (key) => browser.storage.local.get(key),
			set: (value) => browser.storage.local.set(value),
			remove: (key) => browser.storage.local.remove(key)
		};
	}

	if (typeof chrome !== "undefined" && chrome.storage?.local) {
		return {
			get: (key) =>
				new Promise((resolve, reject) => {
					chrome.storage.local.get([key], (result) => {
						if (chrome.runtime.lastError) {
							reject(new Error(chrome.runtime.lastError.message));
							return;
						}

						resolve(result || {});
					});
				}),
			set: (value) =>
				new Promise((resolve, reject) => {
					chrome.storage.local.set(value, () => {
						if (chrome.runtime.lastError) {
							reject(new Error(chrome.runtime.lastError.message));
							return;
						}

						resolve();
					});
				}),
			remove: (key) =>
				new Promise((resolve, reject) => {
					chrome.storage.local.remove([key], () => {
						if (chrome.runtime.lastError) {
							reject(new Error(chrome.runtime.lastError.message));
							return;
						}

						resolve();
					});
				})
		};
	}

	throw new Error("Extension storage API is unavailable.");
}

export async function saveApiKey(apiKey) {
	const key = String(apiKey || "").trim();

	if (!key) {
		throw new Error("API key cannot be empty.");
	}

	const storage = getExtensionStorage();
	await storage.set({ [API_KEY_STORAGE_KEY]: key });
}

export async function getApiKey() {
	const storage = getExtensionStorage();
	const result = await storage.get(API_KEY_STORAGE_KEY);
	return result?.[API_KEY_STORAGE_KEY] || "";
}

export async function deleteApiKey() {
	const storage = getExtensionStorage();
	await storage.remove(API_KEY_STORAGE_KEY);
}

export async function validateApiKey(apiKey) {
	const key = String(apiKey || "").trim();

	if (!key) {
		return { valid: false, message: "API key cannot be empty." };
	}

	try {
		const response = await fetch(BACKEND_VALIDATE_KEY, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ api_key: key })
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "");
			return {
				valid: false,
				message: errorText || `Validation failed with status ${response.status}`
			};
		}

		const payload = await response.json();
		return {
			valid: Boolean(payload?.valid),
			message: payload?.message || (payload?.valid ? "API key is valid." : "API key is invalid.")
		};
	} catch (error) {
		return {
			valid: false,
			message: error instanceof Error ? error.message : "Unable to validate API key."
		};
	}
}
