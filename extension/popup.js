import { deleteApiKey, getApiKey, saveApiKey, validateApiKey } from "./storage.js";

const BACKEND_BASE = "http://127.0.0.1:8000";
const BACKEND_EXTRACT = `${BACKEND_BASE}/extract`;
const BACKEND_INGEST = `${BACKEND_BASE}/ingest`;
const BACKEND_ASK = `${BACKEND_BASE}/ask`;
const CONTENT_SCRIPT_FILE = "content.js";

const elements = {
	currentUrl: document.getElementById("currentUrl"),
	extractButton: document.getElementById("extractButton"),
	refreshUrlButton: document.getElementById("refreshUrlButton"),
	questionInput: document.getElementById("questionInput"),
	askButton: document.getElementById("askButton"),
	answerOutput: document.getElementById("answerOutput"),
	answerWrapper: document.getElementById("answerWrapper"),
	indexedBadge: document.getElementById("indexedBadge"),
	pageTitle: document.getElementById("pageTitle"),
	pageUrl: document.getElementById("pageUrl"),
	charCount: document.getElementById("charCount"),
	questionArea: document.getElementById("questionArea"),
	loadingIndicator: document.getElementById("loadingIndicator"),
	statusMessage: document.getElementById("statusMessage"),
	loadingLabel: document.getElementById("loadingLabel"),
	toggleSettingsButton: document.getElementById("toggleSettingsButton"),
	settingsPanel: document.getElementById("settingsPanel"),
	apiKeyInput: document.getElementById("apiKeyInput"),
	savedKeyMask: document.getElementById("savedKeyMask"),
	saveKeyButton: document.getElementById("saveKeyButton"),
	updateKeyButton: document.getElementById("updateKeyButton"),
	deleteKeyButton: document.getElementById("deleteKeyButton"),
	testKeyButton: document.getElementById("testKeyButton"),
	settingsMessage: document.getElementById("settingsMessage")
};

const state = {
	activeTabId: null,
	currentUrl: "",
	sessionId: "",
	hasStoredApiKey: false
};

function setStatus(message, type = "") {
	elements.statusMessage.textContent = message;
	elements.statusMessage.className = `status-message${type ? ` ${type}` : ''}`;
}

function setSettingsStatus(message, type = "") {
	elements.settingsMessage.textContent = message;
	elements.settingsMessage.className = `status-message${type ? ` ${type}` : ""}`;
}

function setLoading(isLoading) {
	elements.loadingIndicator.hidden = !isLoading;
	elements.extractButton.disabled = isLoading;
	elements.refreshUrlButton.disabled = isLoading;
	if (elements.askButton) elements.askButton.disabled = isLoading;
}

function setSettingsLoading(isLoading) {
	elements.saveKeyButton.disabled = isLoading;
	elements.updateKeyButton.disabled = isLoading;
	elements.deleteKeyButton.disabled = isLoading;
	elements.testKeyButton.disabled = isLoading;
}

function getOrCreateSessionId() {
	if (state.sessionId) {
		return state.sessionId;
	}

	state.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	return state.sessionId;
}

function maskApiKey(apiKey) {
	const key = String(apiKey || "").trim();

	if (!key) {
		return "";
	}

	if (key.length <= 8) {
		return `${"*".repeat(Math.max(0, key.length - 2))}${key.slice(-2)}`;
	}

	return `${key.slice(0, 4)}${"*".repeat(Math.max(0, key.length - 8))}${key.slice(-4)}`;
}

function toggleSettingsPanel() {
	elements.settingsPanel.hidden = !elements.settingsPanel.hidden;

	if (!elements.settingsPanel.hidden) {
		setSettingsStatus("", "");
	}
}

function normalizeText(text) {
	return String(text || "")
		.replace(/\r\n/g, '\n')
		.replace(/[\t\f\v]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ ]{2,}/g, ' ')
		.trim();
}

function unwrapBackendPayload(payload) {
	if (typeof payload === 'string') {
		return payload;
	}

	if (!payload || typeof payload !== 'object') {
		return "";
	}

	return (
		payload.content ||
		payload.text ||
		payload.extracted_content ||
		payload.data?.content ||
		payload.data?.text ||
		payload.reply ||
		""
	);
}

function getActiveTab() {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}

			resolve(tabs?.[0] || null);
		});
	});
}

function executeScript(tabId, files) {
	return new Promise((resolve, reject) => {
		chrome.scripting.executeScript(
			{
				target: { tabId },
				files
			},
			(results) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
					return;
				}

				resolve(results || []);
			}
		);
	});
}

function sendTabMessage(tabId, message) {
	return new Promise((resolve, reject) => {
		chrome.tabs.sendMessage(tabId, message, (response) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}

			resolve(response);
		});
	});
}

async function updateActiveTabState() {
	try {
		const tab = await getActiveTab();

		if (!tab || !tab.url) {
			state.activeTabId = null;
			state.currentUrl = "";
			elements.currentUrl.value = "";
			setStatus("No active tab URL available.", "error");
			return;
		}

		state.activeTabId = tab.id;
		state.currentUrl = tab.url;
		elements.currentUrl.value = tab.url;
		setStatus("Ready.", "success");
	} catch (error) {
		state.activeTabId = null;
		state.currentUrl = "";
		elements.currentUrl.value = "";
		setStatus(`Unable to read the active tab URL: ${error.message}`, "error");
	}
}

async function extractLocalContent() {
	if (state.activeTabId == null) {
		throw new Error("No active tab found.");
	}

	await executeScript(state.activeTabId, [CONTENT_SCRIPT_FILE]);

	const response = await sendTabMessage(state.activeTabId, {
		type: "CHATWEB_EXTRACT_CONTENT"
	});

	return normalizeText(response?.text || response?.content || "");
}

async function fetchBackendContent(url) {
	const response = await fetch(BACKEND_EXTRACT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ url })
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "");
		throw new Error(errorText || `Backend request failed with status ${response.status}`);
	}

	const contentType = response.headers.get("content-type") || "";

	if (contentType.includes("application/json")) {
		const data = await response.json();
		return normalizeText(unwrapBackendPayload(data));
	}

	return normalizeText(await response.text());
}

async function handleExtractClick() {
	if (!state.currentUrl) {
		await updateActiveTabState();
	}

	if (!state.currentUrl) {
		setStatus("Cannot extract content without a valid URL.", "error");
		return;
	}

	setLoading(true);
	elements.loadingLabel.textContent = "Extracting...";
	setStatus("Extracting content...", "");


	let localContent = "";

	try {
		try {
			localContent = await extractLocalContent();
		} catch (error) {
			localContent = "";
		}

		const backendContent = await fetchBackendContent(state.currentUrl).catch(() => "");
		const finalContent = backendContent || localContent;

		if (!finalContent) {
			throw new Error("No content available to index.");
		}

		// After extraction, automatically index (do not display raw content)
		elements.loadingLabel.textContent = "Indexing...";
		setStatus("Indexing page...", "");

		const tab = await getActiveTab();
		const title = tab?.title || "";

		await ingestContent(state.currentUrl, title, finalContent);

		// show only indexed badge and reveal question area
		elements.indexedBadge.hidden = false;
		// keep metadata hidden (do not display title/url/char count)
		if (elements.pageTitle) elements.pageTitle.hidden = true;
		if (elements.pageUrl) elements.pageUrl.hidden = true;
		if (elements.charCount) elements.charCount.hidden = true;

		elements.questionArea.hidden = false;
		elements.answerWrapper.hidden = true;
		elements.questionInput.focus();

		setStatus("Page indexed successfully", "success");
	} catch (error) {
		// do not display raw extraction in UI; only show status
		setStatus(`Extraction / Indexing failed: ${error.message}`, "error");
	} finally {
		setLoading(false);
		elements.loadingLabel.textContent = "Working...";
	}
}


async function ingestContent(url, title, content) {
	const payload = { url, title, content };

	const resp = await fetch(BACKEND_INGEST, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload)
	});

	if (!resp.ok) {
		const txt = await resp.text().catch(() => "");
		throw new Error(txt || `Ingest failed with ${resp.status}`);
	}

	return resp.json().catch(() => ({}));
}


// removed handleIndexClick: indexing happens after extract; no preview shown

async function loadApiKeyState() {
	try {
		const key = await getApiKey();
		state.hasStoredApiKey = Boolean(key);

		if (key) {
			elements.savedKeyMask.textContent = `Saved key: ${maskApiKey(key)}`;
			elements.savedKeyMask.hidden = false;
			elements.apiKeyInput.value = "";
		} else {
			elements.savedKeyMask.hidden = true;
		}
	} catch (error) {
		setSettingsStatus("Could not read API key from browser storage.", "error");
	}
}

async function upsertKey({ isUpdate }) {
	const key = (elements.apiKeyInput.value || "").trim();

	if (!key) {
		setSettingsStatus("Enter an API key first.", "error");
		return;
	}

	setSettingsLoading(true);
	setSettingsStatus("Validating key...", "");

	try {
		const result = await validateApiKey(key);

		if (!result.valid) {
			setSettingsStatus(result.message || "API key is invalid.", "error");
			return;
		}

		await saveApiKey(key);
		await loadApiKeyState();
		setSettingsStatus(isUpdate ? "API key updated successfully." : "API key saved successfully.", "success");
	} catch (error) {
		setSettingsStatus(error instanceof Error ? error.message : "Failed to save API key.", "error");
	} finally {
		setSettingsLoading(false);
	}
}

async function handleDeleteKey() {
	setSettingsLoading(true);

	try {
		await deleteApiKey();
		state.hasStoredApiKey = false;
		elements.apiKeyInput.value = "";
		elements.savedKeyMask.hidden = true;
		setSettingsStatus("API key deleted from local browser storage.", "success");
	} catch (error) {
		setSettingsStatus("Failed to delete API key.", "error");
	} finally {
		setSettingsLoading(false);
	}
}

async function handleTestKey() {
	const typedKey = (elements.apiKeyInput.value || "").trim();
	const storedKey = await getApiKey().catch(() => "");
	const keyToValidate = typedKey || storedKey;

	if (!keyToValidate) {
		setSettingsStatus("Enter a key or save one before testing.", "error");
		return;
	}

	setSettingsLoading(true);
	setSettingsStatus("Testing API key...", "");

	try {
		const result = await validateApiKey(keyToValidate);
		setSettingsStatus(result.message, result.valid ? "success" : "error");
	} finally {
		setSettingsLoading(false);
	}
}

async function requireApiKey() {
	const key = await getApiKey().catch(() => "");

	if (!key) {
		elements.settingsPanel.hidden = false;
		setSettingsStatus("Add and test your Gemini API key before asking questions.", "error");
		throw new Error("Gemini API key is not configured.");
	}

	return key;
}


async function handleAskClick() {
	const question = (elements.questionInput.value || "").trim();
	if (!question) {
		setStatus("Please enter a question.", "error");
		return;
	}

	let apiKey = "";

	try {
		apiKey = await requireApiKey();
	} catch (error) {
		setStatus(error.message, "error");
		return;
	}

	setLoading(true);
	elements.loadingLabel.textContent = "Thinking...";
	setStatus("Thinking...", "");
	elements.answerOutput.value = "";

	try {
		const resp = await fetch(BACKEND_ASK, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				session_id: getOrCreateSessionId(),
				question,
				api_key: apiKey
			})
		});

		if (!resp.ok) {
			const txt = await resp.text().catch(() => "");
			throw new Error(txt || `Backend ask failed with ${resp.status}`);
		}

		const data = await resp.json();
		const answer = data?.answer || data?.reply || JSON.stringify(data || "");
		elements.answerOutput.value = answer;
		elements.answerWrapper.hidden = false;
		setStatus("Answer received", "success");
	} catch (error) {
		setStatus(`Ask failed: ${error.message}`, "error");
	} finally {
		setLoading(false);
		elements.loadingLabel.textContent = "Working...";
	}
}

document.addEventListener("DOMContentLoaded", async () => {
	elements.extractButton.addEventListener("click", handleExtractClick);
	elements.refreshUrlButton.addEventListener("click", updateActiveTabState);
	if (elements.askButton) elements.askButton.addEventListener("click", handleAskClick);
	if (elements.toggleSettingsButton) elements.toggleSettingsButton.addEventListener("click", toggleSettingsPanel);
	if (elements.saveKeyButton) {
		elements.saveKeyButton.addEventListener("click", () => upsertKey({ isUpdate: false }));
	}
	if (elements.updateKeyButton) {
		elements.updateKeyButton.addEventListener("click", () => upsertKey({ isUpdate: true }));
	}
	if (elements.deleteKeyButton) elements.deleteKeyButton.addEventListener("click", handleDeleteKey);
	if (elements.testKeyButton) elements.testKeyButton.addEventListener("click", handleTestKey);

	await updateActiveTabState();
	await loadApiKeyState();
});
