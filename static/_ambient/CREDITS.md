# 白噪音素材署名 / Ambient Sound Credits — static/_ambient/

> ⚠️ 把白噪音音频放进这个目录后，请按下表逐个登记来源、作者和许可。
> 这一步很重要：**注明"从哪个网站下载的"并不等于你就有权把它放进公开仓库**——能不能公开重新分发，取决于该素材自己的许可。
> Fill in one row per audio file you place here. Listing where you downloaded a sound does NOT by itself grant the right to redistribute it publicly — the file's own license does.

下表里的"显示文件名"是放进本目录、阅读器白噪音面板里直接展示的名字；为了界面好看做了重命名，因此另注出每个文件在 Pixabay 上的**原始标题 / 上传者 / 链接**以便追溯。
The "File" column is the in-app display name (renamed for a clean UI); each row also records the original Pixabay title / uploader / URL so the source stays traceable.

| 文件 File | 时长 | 来源链接 Source URL | 作者 Author | 许可 License |
|---|---|---|---|---|
| 雨声.mp3 （原 "Rain sounds. The sound of summer rain"） | 4:07 | https://pixabay.com/sound-effects/rain-sounds-the-sound-of-summer-rain-141793/ | White_Records | Pixabay Content License |
| 细雨.mp3 （原 "Gentle Rain 07"） | 1:30 | https://pixabay.com/sound-effects/nature-gentle-rain-07-437321/ | DRAGON-STUDIO | Pixabay Content License |
| 海浪.mp3 （原 "Ocean Sea Soft Waves"） | 3:00 | https://pixabay.com/sound-effects/nature-ocean-sea-soft-waves-121349/ | SoundsForYou | Pixabay Content License |
| 浪花.mp3 （原 "Ocean Waves"） | 0:22 | https://pixabay.com/sound-effects/nature-ocean-waves-376898/ | DRAGON-STUDIO | Pixabay Content License |
| 林间风.mp3 （原 "Wind In Trees"） | 2:27 | https://pixabay.com/sound-effects/nature-wind-in-trees-117477/ | SoundsForYou | Pixabay Content License |
| 森林鸟鸣.mp3 （原 "Forest wind with birds singing"） | 1:14 | https://pixabay.com/sound-effects/forest-wind-with-birds-singing-364368/ | Eryliaa | Pixabay Content License |
| 壁炉.mp3 （原 "Fireplace"） | 4:23 | https://pixabay.com/sound-effects/fireplace-17909/ | freesound_community（原素材来自 Freesound，CC0） | Pixabay Content License |
| 咖啡馆.mp3 （原 "Cafe da manha"） | 0:20 | https://pixabay.com/sound-effects/film-special-effects-cafe-da-manha-70755/ | freesound_community（原素材来自 Freesound，CC0） | Pixabay Content License |

以上 8 个全部为 **Pixabay Content License**，均**无需署名**（这里仍逐个登记以示尊重与透明）。
All 8 are released under the **Pixabay Content License**; **none require attribution** (we still list each source out of respect and for transparency).

> 关于 Pixabay 许可：可免费用于商业 / 非商业用途、无需署名，并允许作为更大作品的一部分随之分发。唯一红线是不得把素材"原样、单独"再分发或转卖（例如当作独立音效包上架到素材站）。本项目把它们作为阅读器的内置功能音频嵌入分发，属于"更大作品的一部分"，合规。
> About the Pixabay license: free for commercial and non-commercial use, no attribution required, and may be distributed as part of a larger work. The only hard limit is that you may not redistribute or resell the assets "as-is, on a standalone basis" (e.g. re-uploading them as a standalone sound pack to a stock-media site). Bundling them as built-in functional audio inside this reader app counts as "part of a larger work" and is compliant.

## 想再加白噪音？（很简单）/ Adding more sounds

后端是**按本目录动态扫描**加载的（见 mylib/server/routes/media.py 的 /api/ambient/list），不写死文件名。要加新的白噪音：
1. 把音频（.mp3/.ogg/.wav/.m4a/.flac）放进这个文件夹；
2. 文件名起成你想在阅读器里看到的**显示名**（中文即可，例如 `溪流.mp3`、`篝火.mp3`）；
3. 在上表补一行登记来源与许可（自合成的白噪音写"代码生成"即可）。
重启服务、阅读器小窗关掉重开就能看到。

## 哪些可以放进公开仓库？ / What's safe to commit publicly

- ✅ **纯生成的白/粉/棕噪音**（不是真实录音）：一般不受著作权保护，可放心放，注明"代码/工具生成"即可。
- ✅ **CC0 / 公有领域 / Pixabay License**：可自由公开重分发（CC0/PD 不强制署名，但建议仍登记；Pixabay 免署名）。
- ✅ **CC BY**：可重分发，但**必须署名**（作者名、来源链接、许可名都填到上表）。
- ⚠️ **CC BY-NC、"仅个人使用"、"免费下载但未注明可重分发"、来源不明、从音乐/视频网站抓取**：**不要**放进公开仓库。改为：把它们写进 `.gitignore` 不上传，并在 README 里写明用户可以去哪里自行获取；或换成上面几类可公开的素材。
