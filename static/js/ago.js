export function ago(date, future) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const SECONDS = 1000;
    const MINUTES = 60 * SECONDS;
    const HOURS = 60 * MINUTES;
    const DAYS = 24 * HOURS;
    const WEEKS = 7 * DAYS;
    function pluralizeAgo(n, unit) {
        return n + " " + unit + (n == 1 ? "" : "s") + " ago";
    }
    if (diff < 0) {
        return future;
    }
    else if (diff < HOURS) {
        return pluralizeAgo(Math.floor(diff / MINUTES), "minute");
    }
    else if (diff < DAYS) {
        return pluralizeAgo(Math.floor(diff / HOURS), "hour");
    }
    else if (diff < WEEKS) {
        return pluralizeAgo(Math.floor(diff / DAYS), "day");
    }
    else if (diff < 4 * WEEKS) {
        return pluralizeAgo(Math.floor(diff / WEEKS), "week");
    }
    else {
        const months = (now.getUTCFullYear() - date.getUTCFullYear()) * 12 + (now.getUTCMonth() - date.getUTCMonth()) + (now.getUTCDate() - date.getUTCDate()) / 32;
        if (Math.round(months) < 12) {
            return pluralizeAgo(Math.max(1, Math.round(months)), "month");
        }
        else {
            return pluralizeAgo(Math.max(1, Math.round(months / 12)), "year");
        }
    }
}
//# sourceMappingURL=ago.js.map