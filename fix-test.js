const { FilterTypes } = require("@libs/filterInputs");
const defaultCover = require("@libs/defaultCover").default;
const { fetchApi } = require("@libs/fetch");
const { NovelStatus } = require("@libs/novelStatus");
const storage = require("@libs/storage");
const dayjs = require("dayjs");

const statusMap = {
    1: NovelStatus.Ongoing,
    2: NovelStatus.Completed,
    3: NovelStatus.OnHiatus,
    4: NovelStatus.Cancelled,
};

class RanobeLib {
    constructor() {
        this.id = "RLIB";
        this.name = "RanobeLib";
        this.site = "https://ranobelib.me";
        this.apiSite = "https://api.cdnlibs.org/api/manga/";
        this.version = "2.2.0";
        this.icon = "src/ru/ranobelib/icon.png";
        this.webStorageUtilized = true;
        this.user = this.getUser();
        this.filters = {
            sort_by: {
                label: "Сортировка",
                value: "rating_score",
                options: [
                    { label: "По рейтингу", value: "rate_avg" },
                    { label: "По популярности", value: "rating_score" },
                    { label: "По просмотрам", value: "views" },
                    { label: "Количеству глав", value: "chap_count" },
                    { label: "Дате обновления", value: "last_chapter_at" },
                    { label: "Дате добавления", value: "created_at" },
                    { label: "По названию (A-Z)", value: "name" },
                    { label: "По названию (А-Я)", value: "rus_name" },
                ],
                type: FilterTypes.Picker,
            },
            sort_type: {
                label: "Порядок",
                value: "desc",
                options: [
                    { label: "По убыванию", value: "desc" },
                    { label: "По возрастанию", value: "asc" },
                ],
                type: FilterTypes.Picker,
            },
            types: {
                label: "Тип",
                value: [],
                options: [
                    { label: "Япония", value: "10" },
                    { label: "Корея", value: "11" },
                    { label: "Китай", value: "12" },
                    { label: "Английский", value: "13" },
                    { label: "Авторский", value: "14" },
                    { label: "Фанфик", value: "15" },
                ],
                type: FilterTypes.CheckboxGroup,
            },
            scanlateStatus: {
                label: "Статус перевода",
                value: [],
                options: [
                    { label: "Продолжается", value: "1" },
                    { label: "Завершен", value: "2" },
                    { label: "Заморожен", value: "3" },
                    { label: "Заброшен", value: "4" },
                ],
                type: FilterTypes.CheckboxGroup,
            },
            manga_status: {
                label: "Статус тайтла",
                value: [],
                options: [
                    { label: "Онгоинг", value: "1" },
                    { label: "Завершён", value: "2" },
                    { label: "Анонс", value: "3" },
                    { label: "Приостановлен", value: "4" },
                    { label: "Выпуск прекращён", value: "5" },
                ],
                type: FilterTypes.CheckboxGroup,
            },
            genres: {
                label: "Жанры",
                value: { include: [], exclude: [] },
                options: [
                    { label: "Арт", value: "32" },
                    { label: "Безумие", value: "91" },
                    { label: "Боевик", value: "34" },
                    // ... (rest of genres)
                    { label: "Яой", value: "74" },
                ],
                type: FilterTypes.ExcludableCheckboxGroup,
            },
            tags: {
                label: "Теги",
                value: { include: [], exclude: [] },
                options: [
                    { label: "Авантюристы", value: "328" },
                    { label: "Антигерой", value: "175" },
                    // ... (rest of tags)
                    { label: "Якудза", value: "165" },
                ],
                type: FilterTypes.ExcludableCheckboxGroup,
            },
            require_chapters: {
                label: "Только проекты с главами",
                value: true,
                type: FilterTypes.Switch,
            },
        };
    }

    resolveUrl(slug, isNovel) {
        const ui = this.user?.ui ? `ui=${this.user.ui}` : "";
        if (isNovel) {
            return `${this.site}/ru/book/${slug}${ui ? "?" + ui : ""}`;
        }
        const parts = slug.split("/");
        const [i, r, o, v] = parts;
        const s = `${i}/read/v${r}/c${o}${v ? "?bid=" + v : ""}`;
        return `${this.site}/ru/${s}${ui ? (v ? "&" : "?") + ui : ""}`;
    }

    getUser() {
        const user = storage.storage.get("user");
        if (user) {
            return {
                token: { Authorization: "Bearer " + user.token },
                ui: user.id,
            };
        }
        const localAuth = storage.localStorage.get()?.auth;
        if (!localAuth) return {};
        const parsed = JSON.parse(localAuth);
        if (parsed?.token?.access_token) {
            storage.storage.set(
                "user",
                { id: parsed.auth.id, token: parsed.token.access_token },
                parsed.token.timestamp + parsed.token.expires_in
            );
            return {
                token: { Authorization: "Bearer " + parsed.token.access_token },
                ui: parsed.auth.id,
            };
        }
        return undefined;
    }

    async popularNovels(page, { showLatestNovels, filters }) {
        let url = `${this.apiSite}?site_id[0]=3&page=${page}`;
        url += `&sort_by=${showLatestNovels ? "last_chapter_at" : filters?.sort_by?.value || "rating_score"}`;
        url += `&sort_type=${filters?.sort_type?.value || "desc"}`;
        if (filters?.require_chapters?.value) url += "&chapters[min]=1";
        if (filters?.types?.value?.length) url += "&types[]=" + filters.types.value.join("&types[]=");
        if (filters?.scanlateStatus?.value?.length) url += "&scanlateStatus[]=" + filters.scanlateStatus.value.join("&scanlateStatus[]=");
        if (filters?.manga_status?.value?.length) url += "&manga_status[]=" + filters.manga_status.value.join("&manga_status[]=");
        if (filters?.genres) {
            if (filters.genres.value?.include?.length) url += "&genres[]=" + filters.genres.value.include.join("&genres[]=");
            if (filters.genres.value?.exclude?.length) url += "&genres_exclude[]=" + filters.genres.value.exclude.join("&genres_exclude[]=");
        }
        if (filters?.tags) {
            if (filters.tags.value?.include?.length) url += "&tags[]=" + filters.tags.value.include.join("&tags[]=");
            if (filters.tags.value?.exclude?.length) url += "&tags_exclude[]=" + filters.tags.value.exclude.join("&tags_exclude[]=");
        }
        const response = await fetchApi(url, { headers: this.user?.token }).then(res => res.json());
        const novels = [];
        if (Array.isArray(response.data)) {
            response.data.forEach(novel => {
                novels.push({
                    name: novel.rus_name || novel.eng_name || novel.name,
                    cover: novel.cover?.default || defaultCover,
                    path: novel.slug_url || `${novel.id}--${novel.slug}`,
                });
            });
        }
        return novels;
    }

    async parseNovel(slug) {
        const novelData = await fetchApi(
            `${this.apiSite}${slug}?fields[]=summary&fields[]=genres&fields[]=tags&fields[]=teams&fields[]=authors&fields[]=status_id&fields[]=artists`,
            { headers: this.user?.token }
        ).then(res => res.json());
        const l = novelData.data;
        const novel = {
            path: slug,
            name: l.rus_name || l.name || "Unknown Title", // Add fallback value
            cover: l.cover?.default || defaultCover,
            summary: l.summary?.trim(),
        };
        if (l.status?.id) novel.status = statusMap[l.status.id] || NovelStatus.Unknown;
        if (l.authors?.length) novel.author = l.authors[0].name;
        if (l.artists?.length) novel.artist = l.artists[0].name;
        const genres = [l.genres || [], l.tags || []]
            .flat()
            .map(e => e?.name)
            .filter(Boolean);
        if (genres.length) novel.genres = genres.join(", ");
        const teams = (l.teams || []).reduce((acc, team) => {
            const branchId = String(team.details?.branch_id ?? "0");
            acc[branchId] = team.name;
            return acc;
        }, { 0: "Главная страница" });
        const chaptersData = await fetchApi(
            `${this.apiSite}${slug}/chapters`,
            { headers: this.user?.token }
        ).then(res => res.json());
        let chapters = [];
        if (chaptersData.data?.length) {
            chapters = chaptersData.data.flatMap(chap =>
                chap.branches.map(branch => {
                    const branchId = branch.branch_id;
                    const releaseTime = branch.created_at ? dayjs(branch.created_at).format("LLL") : null;
                    const page = teams[String(branchId ?? "0")] || "Неизвестный";
                    return {
                        name: `Том ${chap.volume} Глава ${chap.number}${chap.name ? " " + chap.name.trim() : ""}`,
                        path: `${slug}/${chap.volume}/${chap.number}/${branchId}`,
                        releaseTime,
                        chapterNumber: chap.index,
                        page,
                    };
                })
            );
            if (chapters.length) {
                const uniquePages = new Set(chapters.map(ch => ch.page));
                if (uniquePages.size === 1) {
                    chapters = chapters.map(ch => ({ ...ch, page: undefined }));
                } else if ((l.teams?.length ?? 0) > 1) {
                    chapters.sort((a, b) => {
                        if (a.page && b.page && a.page !== b.page) {
                            return a.page.localeCompare(b.page);
                        }
                        return (a.chapterNumber || 0) - (b.chapterNumber || 0);
                    });
                }
                novel.chapters = chapters;
            }
        }
        return novel;
    }

    async parseChapter(path) {
        const [slug, volume, number, branchId] = path.split("/");
        let content = "";
        if (slug && volume && number) {
            const url = `${this.apiSite}${slug}/chapter?${branchId ? "branch_id=" + branchId + "&" : ""}number=${number}&volume=${volume}`;
            const response = await fetchApi(url, { headers: this.user?.token }).then(res => res.json());
            const data = response.data;
            if (data?.content?.type === "doc") {
                content = parseDocContent(data.content.content, data.attachments || []);
            } else {
                content = data?.content;
            }
        }
        return content;
    }

    async searchNovels(query) {
        const url = `${this.apiSite}?site_id[0]=3&q=${query}`;
        const response = await fetchApi(url, { headers: this.user?.token }).then(res => res.json());
        const novels = [];
        if (Array.isArray(response.data)) {
            response.data.forEach(novel => {
                novels.push({
                    name: novel.rus_name || novel.eng_name || novel.name || "Unknown Title",
                    cover: novel.cover?.default || defaultCover,
                    path: novel.slug_url || `${novel.id}--${novel.slug}`,
                });
            });
        }
        return novels;
    }
}

function parseDocContent(content, attachments, html = "") {
    content.forEach(node => {
        switch (node.type) {
            case "hardBreak":
                html += "<br>";
                break;
            case "horizontalRule":
                html += "<hr>";
                break;
            case "image":
                if (node.attrs?.images?.length) {
                    node.attrs.images.forEach(img => {
                        const att = attachments.find(a => a.name === img.image || a.id === img.image);
                        if (att) html += `<img src='${att.url}'>`;
                    });
                } else if (node.attrs) {
                    const attrs = Object.entries(node.attrs)
                        .filter(([_, v]) => v)
                        .map(([k, v]) => `${k}="${v}"`);
                    html += `<img ${attrs.join("; ")}>`;
                }
                break;
            case "paragraph":
                html += `<p>${node.content ? parseDocContent(node.content, attachments) : "<br>"}</p>`;
                break;
            case "orderedList":
                html += `<ol>${node.content ? parseDocContent(node.content, attachments) : "<br>"}</ol>`;
                break;
            case "listItem":
                html += `<li>${node.content ? parseDocContent(node.content, attachments) : "<br>"}</li>`;
                break;
            case "blockquote":
                html += `<blockquote>${node.content ? parseDocContent(node.content, attachments) : "<br>"}</blockquote>`;
                break;
            case "italic":
                html += `<i>${node.content ? parseDocContent(node.content, attachments) : "<br>"}</i>`;
                break;
            case "bold":
                html += `<b>${node.content ? parseDocContent(node.content, attachments) : "<br>"}</b>`;
                break;
            case "underline":
                html += `<u>${node.content ? parseDocContent(node.content, attachments) : "<br>"}</u>`;
                break;
            case "heading":
                html += `<h2>${node.content ? parseDocContent(node.content, attachments) : "<br>"}</h2>`;
                break;
            case "text":
                html += node.text;
                break;
            default:
                html += JSON.stringify(node, null, "\t");
        }
    });
    return html;
}

exports.default = new RanobeLib();