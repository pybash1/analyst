import {
	App,
	Editor,
	ItemView,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
} from "obsidian"

const PROMPT = `You will be given an array of words, analyse the words.
Your OUTPUT MUST ALWAYS BE IN JSON FORMAT.
KEYS for the JSON object will the NUMBER OF THE ITEM IN THE LIST AS A STRING.
If OPTIONS are PROVIDED then the value in the key/value pair will be JUST THE MOST DOMINANT OPTION AS A STRING.
If OPTIONS are NOT PROVIDED then the value in the key/value pair will be an ARRAY of NUMBERS representing the PERCENTAGES of EACH characteristic IN THE ORDER OF THE INPUT.

An example output:
{
	1: "Joy",
	2: "Work",
	3: [40, 60],
	4: [21, 79],
	5: [46, 54],
	6: [10, 90],
	7: "Present",
	8: "Sight",
	9: "I"
}

1. Feeling
   Options: Love, Anger, Joy, Fear, Overwhelm, Sadness
2. Thinking Mostly About
   Options: Work, Health, Improvement, Play, Spirituality, Family, Friends, Home, Money
3. Introvert / Extrovert
4. Positive / Negative
5. Uncertain / Certain
6. Feeling / Thinking
7. Time Orientation
   Options: Past, Present, Future
8. Primary Sense
   Options: Hearing, Sight, Smell, Touch
9. Us and Them
   Options: Us, Them, You, I

Input Word Array: `

const VIEW_HTML = (
	feeling: string,
	thinking: string,
	ie1: string,
	ie2: string,
	pn1: string,
	pn2: string,
	cu1: string,
	cu2: string,
	ft1: string,
	ft2: string,
	time: string,
	sense: string,
	person: string,
	unanalysed = false,
) =>
	unanalysed
		? `<h2 class="px-4">Sentimental Analysis</h2><h4 class="px-4">Analysis not done yet.</h4>`
		: `
<h2 class="px-4">Sentimental Analysis</h2>
<div class="flex flex-col gap-2 px-4">
	<div class="flex items-center gap-3">
		<h4 class="text-lg font-bold">Feeling</h4>
		<div id="feeling">${feeling}</div>
	</div>
	<div class="flex items-center gap-3">
		<h4 class="text-lg font-bold">Thinking Mostly About</h4>
		<div id="thinking">${thinking}</div>
	</div>
	<div class="flex items-center gap-1.5">
		<h4 class="text-lg font-bold" id="i-e-1">${ie1}</h4>
		/ <span id="i-e-2">${ie2}</span>
	</div>
	<div class="flex items-center gap-1.5">
		<h4 class="text-lg font-bold" id="p-n-1">${pn1}</h4>
		/ <span id="p-n-2">${pn2}</span>
	</div>
	<div class="flex items-center gap-1.5">
		<h4 class="text-lg font-bold" id="c-u-1">${cu1}</h4>
		/ <span id="c-u-2">${cu2}</span>
	</div>
	<div class="flex items-center gap-1.5">
		<h4 class="text-lg font-bold" id="f-t-1">${ft1}</h4>
		/ <span id="f-t-2">${ft2}</span>
	</div>
	<div class="flex items-center gap-3">
		<h4 class="text-lg font-bold">Time Orientation</h4>
		<div id="time">${time}</div>
	</div>
	<div class="flex items-center gap-3">
		<h4 class="text-lg font-bold">Primary Sense</h4>
		<div id="sense">${sense}</div>
	</div>
	<div class="flex items-center gap-3">
		<h4 class="text-lg font-bold">Us and Them</h4>
		<div id="person">${person}</div>
	</div>
</div>`

const ANALYSIS_VIEW = "analysis-view"

interface AnalystSettings {
	openaiKey: string
	licenseKey: string
}

const DEFAULT_SETTINGS: AnalystSettings = {
	openaiKey: "",
	licenseKey: "",
}

export default class AnalystPlugin extends Plugin {
	settings: AnalystSettings
	sbitem: HTMLElement

	async onload() {
		await this.loadSettings()

		this.registerView(ANALYSIS_VIEW, (leaf) => new AnalysisView(leaf))
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", async (leaf) => {
				if (leaf?.view.getViewType() === "markdown")
					this.sbitem.children[0].innerHTML = await this.analyse(undefined, false)
				else this.sbitem.children[0].innerHTML = ""
			}),
		)
		this.addCommand({
			id: "analyse",
			name: "Analyse file",
			editorCallback: (editor) => this.analyse(editor),
		})

		this.addSettingTab(new AnalystSettingsTab(this.app, this))

		this.sbitem = this.addStatusBarItem()
		const div = document.createElement("div")
		div.innerHTML = await this.analyse(undefined, false)
		this.sbitem.appendChild(div)
	}

	async checkLicense(license: string) {
		const form = new FormData()
		form.append("product_id", "nR5SsKONHZ1cXUv5RixfAQ==")
		form.append("license_key", license)
		const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
			method: "POST",
			body: form,
		})
		const data = await res.json()

		return (
			data?.success &&
			!data?.purchase?.subscription_ended_at &&
			!data?.purchase?.subscription_cancelled_at &&
			!data?.purchase?.subscription_failed_at
		)
	}

	async activateView(data: string) {
		const { workspace } = this.app

		let leaf: WorkspaceLeaf | null = null

		const leaves = workspace.getLeavesOfType(ANALYSIS_VIEW)

		if (leaves.length > 0) {
			leaf = leaves[0]
		} else {
			leaf = workspace.getRightLeaf(false)
			await leaf.setViewState({ type: ANALYSIS_VIEW, active: true })
		}

		try {
			const results = JSON.parse(data)
			leaf.view.containerEl.innerHTML = VIEW_HTML(
				results[1],
				results[2],
				results[3][0] > results[3][1]
					? "Introvert " + results[3][0] + "%"
					: "Extrovert " + results[3][1] + "%",
				results[3][0] > results[3][1]
					? "Extrovert " + results[3][1] + "%"
					: "Introvert " + results[3][0] + "%",
				results[4][0] > results[4][1]
					? "Positive " + results[4][0] + "%"
					: "Negative " + results[4][1] + "%",
				results[4][0] > results[4][1]
					? "Negative " + results[4][1] + "%"
					: "Positive " + results[4][0] + "%",
				results[5][0] > results[5][1]
					? "Certain " + results[5][0] + "%"
					: "Uncertain " + results[5][1] + "%",
				results[5][0] > results[5][1]
					? "Uncertain " + results[5][1] + "%"
					: "Certain " + results[5][0] + "%",
				results[6][0] > results[6][1]
					? "Feeling " + results[6][0] + "%"
					: "Thinking " + results[6][1] + "%",
				results[6][0] > results[6][1]
					? "Thinking " + results[6][1] + "%"
					: "Feeling " + results[6][0] + "%",
				results[7],
				results[8],
				results[9],
			)
			workspace.revealLeaf(leaf)
		} catch {
			new Notice("Some error occured while analysing!")
		}
	}

	async analyse(editor?: Editor, view = true) {
		if (!this.settings.licenseKey && !this.settings.openaiKey) {
			new Notice(
				"Neither OpenAI key nor License key are set. The Analyst plugin requires atleast one of them to function.",
			)
			return ""
		}

		const valid = await this.checkLicense(this.settings.licenseKey)

		if (!this.settings.openaiKey && !valid) {
			new Notice("License key is invalid or expired!")
			return
		}

		if (!editor) {
			editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor
		}

		const contents = editor?.getValue() ?? ""
		const words = contents.split(" ").length

		if (words < 100) new Notice("File must have atleast a 100 words to be analysed")
		else {
			const res = await fetch(
				valid
					? "https://analyst-1-s7586344.deta.app/gpt"
					: "https://api.openai.com/v1/chat/completions",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${valid ? this.settings.licenseKey : this.settings.openaiKey}`,
					},
					body: JSON.stringify({
						model: "gpt-4",
						messages: [
							{
								role: "system",
								content:
									"You are a skilled emotion detecting robot. You can detect different types of writing.",
							},
							{
								role: "user",
								content: PROMPT + "[" + contents.split(" ").join(", ") + "]",
							},
						],
					}),
				},
			)

			if (!res.ok) {
				new Notice("Error occured while analysing!")
				return ""
			}

			const result = valid
				? (await res.json()).response
				: (await res.json()).choices[0].message.content
			if (typeof view === "boolean" && view) this.activateView(result)

			return result.split("\n")[0].substring(3)
		}

		return ""
	}

	onunload() {
		// Nothing to clean up
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}
}

class AnalystSettingsTab extends PluginSettingTab {
	plugin: AnalystPlugin

	constructor(app: App, plugin: AnalystPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		new Setting(containerEl)
			.setName("Get a license key")
			.addButton((btn) =>
				btn
					.onClick(() => window.open("https://store.pybash.xyz/l/analyst", "_blank"))
					.setButtonText("Buy License"),
			)

		new Setting(containerEl)
			.setName("License key")
			.setDesc("This is not required if you want to use your own API key.")
			.addText((text) =>
				text
					.setPlaceholder("Enter your license key")
					.setValue(this.plugin.settings.licenseKey)
					.onChange(async (value) => {
						this.plugin.settings.licenseKey = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName("OpenAI key")
			.setDesc("This is not required if you have a license key.")
			.addText((text) =>
				text
					.setPlaceholder("Enter your OpenAI key")
					.setValue(this.plugin.settings.openaiKey)
					.onChange(async (value) => {
						this.plugin.settings.openaiKey = value
						await this.plugin.saveSettings()
					}),
			)
	}
}

class AnalysisView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf)
	}

	getViewType() {
		return ANALYSIS_VIEW
	}

	getDisplayText() {
		return "Analysis board"
	}

	async onOpen() {
		const container = this.containerEl.children[1]
		container.empty()

		const items = document.createElement("div")
		items.innerHTML = VIEW_HTML("", "", "", "", "", "", "", "", "", "", "", "", "", true)
		container.appendChild(items)
	}

	async onClose() {
		// Nothing to clean up
	}
}
