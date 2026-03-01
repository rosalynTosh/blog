import { ago } from "./ago.js";
const FUTURE = "the future (is client clock offset?)";
setInterval(() => {
    for (const span of document.getElementsByClassName("date")) {
        span.textContent = ago(new Date(span.title), FUTURE);
    }
}, 500);
//# sourceMappingURL=tick-script.js.map