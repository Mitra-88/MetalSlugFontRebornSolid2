import { createSignal, For, onSettled, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { ThemeToggle } from "../Page.tsx";
import { Page } from "../Page.tsx";
import { Info } from "../lib/icons.tsx";

function parseLicense(text: string): { heading: string; body: string[] }[] {
    const blocks: { heading: string; body: string[] }[] = [];
    let current: { heading: string; body: string[] } | null = null;
    for (const raw of text.split("\n")) {
        const line = raw.replace(/\s+$/, "");
        const trimmed = line.trim();
        if (/^(GNU GENERAL PUBLIC LICENSE|Preamble|TERMS AND CONDITIONS|How to Apply These Terms|END OF TERMS|Version \d)/.test(trimmed) && trimmed.length > 0) {
            current = { heading: trimmed, body: [] };
            blocks.push(current);
            continue;
        }
        if (current) current.body.push(line);
        else {
            current = { heading: "", body: [line] };
            blocks.push(current);
        }
    }
    return blocks;
}

export default function License(): JSX.Element {
    const [licenseText, setLicenseText] = createSignal("");
    const [loadError, setLoadError] = createSignal(false);

    onSettled(() => {
        fetch("./assets/license.txt")
            .then((r) => r.text())
            .then((t) => setLicenseText(t))
            .catch(() => setLoadError(true));
    });

    return (
        <Page
            back
            actions={<ThemeToggle />}
            links={[
                { href: "./index.html", label: "Generator", icon: "autoAwesome" },
                { href: "./examples.html", label: "Browse examples", icon: "image" },
                { href: "./supported.html", label: "Supported characters", icon: "help" },
            ]}
        >
            <header class="rise-in mx-auto mb-6 max-w-2xl text-center">
                <h1 class="text-display-s">License</h1>
                <p class="mx-auto mt-2 text-body-l text-on-surface-variant">Licensed under GNU General Public License v3.</p>
            </header>

            <Show when={licenseText()}>{(text) => <LicenseBody text={text()} />}</Show>
            <Show when={loadError()}>
                <div class="error-box mx-auto max-w-2xl" role="alert">
                    The license text did not load. It is also in the LICENSE file at the root of the repository.
                </div>
            </Show>
        </Page>
    );
}

function LicenseBody(props: { text: string }): JSX.Element {
    const blocks = parseLicense(props.text);
    return (
        <section class="rise-in card mx-auto max-w-4xl overflow-hidden">
            <div class="flex items-center gap-2 border-b border-outline-variant bg-surface-container px-5 py-3">
                <Info size={18} />
                <h2 class="text-title-m">GNU General Public License v3</h2>
                <span class="chip-static ml-auto">GPL-3.0-only</span>
            </div>
            <div class="max-h-[70vh] overflow-y-auto p-5 sm:p-8">
                <For each={blocks}>
                    {(block) => (
                        <div class="mx-auto mb-6 max-w-2xl text-center last:mb-0">
                            <Show when={block.heading}>
                                <h3 class="text-body-m font-semibold text-on-surface">{block.heading}</h3>
                            </Show>
                            <pre class="mt-2 whitespace-pre-wrap break-words text-center font-mono text-[0.8rem] leading-relaxed text-on-surface-variant [overflow-wrap:anywhere]">{block.body.join("\n")}</pre>
                        </div>
                    )}
                </For>
            </div>
        </section>
    );
}
