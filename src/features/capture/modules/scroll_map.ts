let scrollMapContainer: HTMLElement | null = null;
let scrollContainer: HTMLElement | Window | null = null;
let scrollResizeObserver: ResizeObserver | null = null;

function getScrollContainer(): HTMLElement | Window {
	if (document.documentElement.scrollTop > 0 || document.body.scrollTop > 0) {
		return window;
	}

	const divs = document.querySelectorAll("div");
	let bestCandidate: HTMLElement | null = null;
	let maxScrollHeight = 0;

	divs.forEach((div) => {
		const style = window.getComputedStyle(div);
		if (style.overflowY === "auto" || style.overflowY === "scroll") {
			if (
				div.scrollHeight > div.clientHeight &&
				div.scrollHeight > maxScrollHeight
			) {
				maxScrollHeight = div.scrollHeight;
				bestCandidate = div;
			}
		}
	});

	return bestCandidate || window;
}

export function initScrollMap() {
	if (scrollMapContainer) return;

	scrollMapContainer = document.createElement("div");
	scrollMapContainer.id = "threadmark-scrollmap";
	Object.assign(scrollMapContainer.style, {
		position: "fixed",
		top: "0",
		right: "0",
		width: "16px",
		height: "100vh",
		zIndex: "9999",
		pointerEvents: "none",
	});
	document.body.appendChild(scrollMapContainer);

	scrollContainer = getScrollContainer();

	if (scrollContainer instanceof HTMLElement) {
		scrollResizeObserver = new ResizeObserver(() => {
			updateScrollMap();
		});
		scrollResizeObserver.observe(scrollContainer);
		scrollResizeObserver.observe(document.body);
	} else {
		window.addEventListener("resize", updateScrollMap);
	}
}

export function updateScrollMap() {
	if (!scrollMapContainer) initScrollMap();
	if (!scrollMapContainer) return;

	scrollMapContainer.innerHTML = "";

	const highlights = document.querySelectorAll(".threadmark-highlight");
	if (highlights.length === 0) return;

	let scrollHeight = 0;
	let clientHeight = 0;

	if (scrollContainer instanceof HTMLElement) {
		scrollHeight = scrollContainer.scrollHeight;
		clientHeight = scrollContainer.clientHeight;
	} else {
		scrollHeight = document.documentElement.scrollHeight;
		clientHeight = window.innerHeight;
	}

	if (scrollHeight <= clientHeight) return;

	highlights.forEach((hl) => {
		const el = hl as HTMLElement;
		let top = 0;

		if (scrollContainer instanceof HTMLElement) {
			const rect = el.getBoundingClientRect();
			const containerRect = scrollContainer.getBoundingClientRect();
			top = scrollContainer.scrollTop + (rect.top - containerRect.top);
		} else {
			const rect = el.getBoundingClientRect();
			top = window.scrollY + rect.top;
		}

		const ratio = top / scrollHeight;
		const percentage = ratio * 100;

		const marker = document.createElement("div");
		Object.assign(marker.style, {
			position: "absolute",
			top: `${percentage}%`,
			right: "2px",
			width: "12px",
			height: "4px",
			backgroundColor: "#ffd700",
			borderRadius: "2px",
			cursor: "pointer",
			pointerEvents: "auto",
			boxShadow: "0 0 2px rgba(0,0,0,0.5)",
			zIndex: "10000",
		});

		marker.title = "Go to bookmark";
		marker.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			el.scrollIntoView({ behavior: "smooth", block: "center" });
		});

		scrollMapContainer?.appendChild(marker);
	});
}
