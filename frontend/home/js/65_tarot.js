// ╔══ 65_tarot.js —— 塔罗抽牌（v4.3.0 从 demo 移植进正式面板）══╗
// 本文件是 /static/home.js 的一段：后端按文件名顺序拼接后整体下发，无构建步。
// 交互定稿（demo 验收版）：按住才动、横滑转牌扇、把中间那张往下拖出才算抽——
// 拖动时牌跟手离开牌扇、微微放大，拖过阈值亮金边=「松手即抽」，没拖够松手弹簧回位。
// 没有「抽牌」按钮。抽走的牌从扇里消失，剩下的自动转正补位。

// ── 22 张大阿卡纳（图标为 Remix 24 网格线稿，与全站图标同源）──
const TAROT_ICON={"愚者":"<path d=\"M7.61713 8.71233L10.8222 6.38373C11.174 6.12735 11.6087 5.98543 12.065 6.0008C13.1764 6.02813 14.1524 6.75668 14.4919 7.82036C14.6782 8.40431 14.8481 8.79836 15.0017 9.0025C15.914 10.2155 17.3655 11 19.0002 11V13C16.8255 13 14.8825 12.0083 13.5986 10.4526L12.901 14.4085L14.9621 16.138L17.1853 22.246L15.3059 22.93L13.266 17.3256L9.87576 14.4808C9.32821 14.0382 9.03139 13.3192 9.16231 12.5767L9.67091 9.6923L8.99407 10.1841L6.86706 13.1116L5.24902 11.9361L7.60016 8.7L7.61713 8.71233ZM13.5002 5.5C12.3956 5.5 11.5002 4.60457 11.5002 3.5C11.5002 2.39543 12.3956 1.5 13.5002 1.5C14.6047 1.5 15.5002 2.39543 15.5002 3.5C15.5002 4.60457 14.6047 5.5 13.5002 5.5ZM10.5286 18.6813L7.31465 22.5116L5.78257 21.226L8.75774 17.6803L9.50426 15.5L11.2954 17L10.5286 18.6813Z\"/>","魔术师":"<path d=\"M15.2238 15.5079L13.0111 20.1581C12.8687 20.4573 12.5107 20.5844 12.2115 20.442C12.1448 20.4103 12.0845 20.3665 12.0337 20.3129L8.49229 16.5741C8.39749 16.474 8.27113 16.4096 8.13445 16.3918L3.02816 15.7243C2.69958 15.6814 2.46804 15.3802 2.51099 15.0516C2.52056 14.9784 2.54359 14.9075 2.5789 14.8426L5.04031 10.3192C5.1062 10.1981 5.12839 10.058 5.10314 9.92253L4.16 4.85991C4.09931 4.53414 4.3142 4.22086 4.63997 4.16017C4.7126 4.14664 4.78711 4.14664 4.85974 4.16017L9.92237 5.10331C10.0579 5.12855 10.198 5.10637 10.319 5.04048L14.8424 2.57907C15.1335 2.42068 15.4979 2.52825 15.6562 2.81931C15.6916 2.88421 15.7146 2.95507 15.7241 3.02833L16.3916 8.13462C16.4095 8.2713 16.4739 8.39766 16.5739 8.49245L20.3127 12.0338C20.5533 12.2617 20.5636 12.6415 20.3357 12.8821C20.2849 12.9357 20.2246 12.9795 20.1579 13.0112L15.5078 15.224C15.3833 15.2832 15.283 15.3835 15.2238 15.5079ZM16.0206 17.435L17.4348 16.0208L21.6775 20.2634L20.2633 21.6776L16.0206 17.435Z\"/>","女祭司":"<path d=\"M21 18H6C5.44772 18 5 18.4477 5 19C5 19.5523 5.44772 20 6 20H21V22H6C4.34315 22 3 20.6569 3 19V4C3 2.89543 3.89543 2 5 2H21V18ZM16 9V7H8V9H16Z\"/>","皇后":"<path d=\"M12.455 2.30885L11.9998 2.07617L11.5447 2.30885C10.3952 2.89646 9.35317 3.6638 8.45557 4.57394C9.77392 5.26024 10.9693 6.15018 12.0001 7.20207C13.0308 6.15028 14.2261 5.26041 15.5443 4.57414C14.6466 3.66391 13.6045 2.8965 12.455 2.30885ZM10.6993 8.73433C8.98925 6.93503 6.72625 5.66541 4.18066 5.19783L3 4.98096V13.0002C3 16.8047 5.36065 20.0579 8.69711 21.3748C8.24472 19.9984 8 18.5278 8 17C8 13.9083 9.00215 11.0507 10.6993 8.73433ZM21 4.98096L19.8193 5.19783C14.233 6.22396 10 11.1168 10 17.0002C10 18.5362 10.2891 20.0071 10.8167 21.3598L11.0569 21.9754C11.3711 21.9852 11.6856 22.0002 12 22.0002C16.9706 22.0002 21 17.9708 21 13.0002V4.98096Z\"/>","皇帝":"<path d=\"M2.00488 19H22.0049V21H2.00488V19ZM2.00488 5L7.00488 8L12.0049 2L17.0049 8L22.0049 5V17H2.00488V5Z\"/>","教皇":"<path d=\"M1.51587 7.87678C1.67997 9.82977 3.0892 11.452 5.00006 11.8875V19.0013H3.00006V21.0013H21.0001V19.0013H19.0001V11.8875C20.9109 11.452 22.3202 9.82977 22.4842 7.87678C21.9938 7.95878 21.4973 8 21.0001 8C17.186 8 13.7861 5.59592 12.5148 2H11.4853C10.214 5.59592 6.81411 8 3.00006 8C2.50278 8 2.00635 7.95878 1.51587 7.87678ZM17.0001 19.0013H7.00006V12H17.0001V19.0013Z\"/>","恋人":"<path d=\"M16.5 3C19.5376 3 22 5.5 22 9C22 16 14.5 20 12 21.5C9.5 20 2 16 2 9C2 5.5 4.5 3 7.5 3C9.35997 3 11 4 12 5C13 4 14.64 3 16.5 3Z\"/>","战车":"<path d=\"M19 20H5V21C5 21.5523 4.55228 22 4 22H3C2.44772 22 2 21.5523 2 21V12L4.51334 5.29775C4.80607 4.51715 5.55231 4 6.386 4H17.614C18.4477 4 19.1939 4.51715 19.4867 5.29775L22 12V21C22 21.5523 21.5523 22 21 22H20C19.4477 22 19 21.5523 19 21V20ZM4.136 12H19.864L17.614 6H6.386L4.136 12ZM6.5 17C7.32843 17 8 16.3284 8 15.5C8 14.6716 7.32843 14 6.5 14C5.67157 14 5 14.6716 5 15.5C5 16.3284 5.67157 17 6.5 17ZM17.5 17C18.3284 17 19 16.3284 19 15.5C19 14.6716 18.3284 14 17.5 14C16.6716 14 16 14.6716 16 15.5C16 16.3284 16.6716 17 17.5 17Z\"/>","力量":"<path d=\"M3.78307 2.82598L12 1L20.2169 2.82598C20.6745 2.92766 21 3.33347 21 3.80217V13.7889C21 15.795 19.9974 17.6684 18.3282 18.7812L12 23L5.6718 18.7812C4.00261 17.6684 3 15.795 3 13.7889V3.80217C3 3.33347 3.32553 2.92766 3.78307 2.82598ZM12 13.5L14.9389 15.0451L14.3776 11.7725L16.7553 9.45492L13.4695 8.97746L12 6L10.5305 8.97746L7.24472 9.45492L9.62236 11.7725L9.06107 15.0451L12 13.5Z\"/>","隐者":"<path d=\"M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM16.5 7.5L10 10L7.5 16.5L14 14L16.5 7.5ZM12 13C11.4477 13 11 12.5523 11 12C11 11.4477 11.4477 11 12 11C12.5523 11 13 11.4477 13 12C13 12.5523 12.5523 13 12 13Z\"/>","命运之轮":"<path d=\"M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM16.8201 17.0761C18.1628 15.8007 19 13.9981 19 12C19 8.13401 15.866 5 12 5C10.9391 5 9.9334 5.23599 9.03241 5.65834L10.0072 7.41292C10.6177 7.14729 11.2917 7 12 7C14.7614 7 17 9.23858 17 12H14L16.8201 17.0761ZM14.9676 18.3417L13.9928 16.5871C13.3823 16.8527 12.7083 17 12 17C9.23858 17 7 14.7614 7 12H10L7.17993 6.92387C5.83719 8.19929 5 10.0019 5 12C5 15.866 8.13401 19 12 19C13.0609 19 14.0666 18.764 14.9676 18.3417Z\"/>","正义":"<path d=\"M12.9985 2L12.9979 3.278L17.9985 4.94591L21.631 3.73509L22.2634 5.63246L19.2319 6.643L22.3272 15.1549C21.2353 16.2921 19.6996 17 17.9985 17C16.2975 17 14.7618 16.2921 13.6699 15.1549L16.7639 6.643L12.9979 5.387V19H16.9985V21H6.99854V19H10.9979V5.387L7.23192 6.643L10.3272 15.1549C9.23528 16.2921 7.69957 17 5.99854 17C4.2975 17 2.76179 16.2921 1.66992 15.1549L4.76392 6.643L1.73363 5.63246L2.36608 3.73509L5.99854 4.94591L10.9979 3.278L10.9985 2H12.9985ZM17.9985 9.10267L16.5809 13H19.4159L17.9985 9.10267ZM5.99854 9.10267L4.58092 13H7.41592L5.99854 9.10267Z\"/>","倒吊人":"<path d=\"M6 4H4V2H20V4H18V6C18 7.61543 17.1838 8.91468 16.1561 9.97667C15.4532 10.703 14.598 11.372 13.7309 12C14.598 12.628 15.4532 13.297 16.1561 14.0233C17.1838 15.0853 18 16.3846 18 18V20H20V22H4V20H6V18C6 16.3846 6.81616 15.0853 7.8439 14.0233C8.54682 13.297 9.40202 12.628 10.2691 12C9.40202 11.372 8.54682 10.703 7.8439 9.97667C6.81616 8.91468 6 7.61543 6 6V4ZM8 4V6C8 6.68514 8.26026 7.33499 8.77131 8H15.2287C15.7397 7.33499 16 6.68514 16 6V4H8ZM12 13.2219C10.9548 13.9602 10.008 14.663 9.2811 15.4142C9.09008 15.6116 8.92007 15.8064 8.77131 16H15.2287C15.0799 15.8064 14.9099 15.6116 14.7189 15.4142C13.992 14.663 13.0452 13.9602 12 13.2219Z\"/>","死神":"<path d=\"M12 2C17.5228 2 22 6.47715 22 12V15.7639C22 16.5215 21.572 17.214 20.8944 17.5528L18 19V20C18 21.5977 16.7511 22.9037 15.1763 22.9949L14.9499 23.0004C14.9718 22.8926 14.9868 22.7823 14.9943 22.67L15 22.5V22C15 20.9456 14.1841 20.0818 13.1493 20.0055L13 20H11C9.94564 20 9.08183 20.8159 9.00549 21.8507L9 22V22.5C9 22.6714 9.01725 22.8387 9.0501 23.0004L9 23C7.34315 23 6 21.6569 6 20V19L3.10557 17.5528C2.428 17.214 2 16.5215 2 15.7639V12C2 6.47715 6.47715 2 12 2ZM8 11C6.89543 11 6 11.8954 6 13C6 14.1046 6.89543 15 8 15C9.10457 15 10 14.1046 10 13C10 11.8954 9.10457 11 8 11ZM16 11C14.8954 11 14 11.8954 14 13C14 14.1046 14.8954 15 16 15C17.1046 15 18 14.1046 18 13C18 11.8954 17.1046 11 16 11Z\"/>","节制":"<path d=\"M11 19V13.8889L3 5V3H21V5L13 13.8889V19H18V21H6V19H11ZM7.49073 7H16.5093L18.3093 5H5.69072L7.49073 7Z\"/>","恶魔":"<path d=\"M12 23C7.85786 23 4.5 19.6421 4.5 15.5C4.5 13.3462 5.40786 11.4045 6.86179 10.0366C8.20403 8.77375 11.5 6.49951 11 1.5C17 5.5 20 9.5 14 15.5C15 15.5 16.5 15.5 19 13.0296C19.2697 13.8032 19.5 14.6345 19.5 15.5C19.5 19.6421 16.1421 23 12 23Z\"/>","高塔":"<path d=\"M16.9885 18L18.2044 16.4194C18.4061 16.1572 18.5154 15.8356 18.5154 15.5048C18.5154 14.6764 17.8439 14.0048 17.0154 14.0048H15V10.0291C15 9.56319 14.7835 9.12374 14.4141 8.83982C13.7573 8.33495 12.8156 8.45813 12.3107 9.11494L5.9453 17.3961C3.04248 16.1959 1 13.3365 1 10C1 5.58172 4.58172 2 9 2C12.3949 2 15.2959 4.11466 16.4576 7.09864C16.7951 7.0339 17.1436 7 17.5 7C20.5376 7 23 9.46243 23 12.5C23 15.5376 20.5376 18 17.5 18H16.9885ZM13 16.0048H16L11 22.5048V18.0048H8L13 11.5V16.0048Z\"/>","星星":"<path d=\"M12.0006 18.26L4.94715 22.2082L6.52248 14.2799L0.587891 8.7918L8.61493 7.84006L12.0006 0.5L15.3862 7.84006L23.4132 8.7918L17.4787 14.2799L19.054 22.2082L12.0006 18.26Z\"/>","月亮":"<path d=\"M11.3807 2.01886C9.91573 3.38768 9 5.3369 9 7.49999C9 11.6421 12.3579 15 16.5 15C18.6631 15 20.6123 14.0843 21.9811 12.6193C21.6613 17.8537 17.3149 22 12 22C6.47715 22 2 17.5228 2 12C2 6.68514 6.14629 2.33869 11.3807 2.01886Z\"/>","太阳":"<path d=\"M12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18ZM11 1H13V4H11V1ZM11 20H13V23H11V20ZM3.51472 4.92893L4.92893 3.51472L7.05025 5.63604L5.63604 7.05025L3.51472 4.92893ZM16.9497 18.364L18.364 16.9497L20.4853 19.0711L19.0711 20.4853L16.9497 18.364ZM19.0711 3.51472L20.4853 4.92893L18.364 7.05025L16.9497 5.63604L19.0711 3.51472ZM5.63604 16.9497L7.05025 18.364L4.92893 20.4853L3.51472 19.0711L5.63604 16.9497ZM23 11V13H20V11H23ZM4 11V13H1V11H4Z\"/>","审判":"<path d=\"M21 10.063V4C21 3.44772 20.5523 3 20 3H19C17.0214 4.97864 13.3027 6.08728 11 6.61281V17.3872C13.3027 17.9127 17.0214 19.0214 19 21H20C20.5523 21 21 20.5523 21 20V13.937C21.8626 13.715 22.5 12.9319 22.5 12 22.5 11.0681 21.8626 10.285 21 10.063ZM5 7C3.89543 7 3 7.89543 3 9V15C3 16.1046 3.89543 17 5 17H6L7 22H9V7H5Z\"/>","世界":"<path d=\"M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM16.0043 12.8777C15.6589 12.3533 15.4097 11.9746 14.4622 12.1248C12.6717 12.409 12.4732 12.7224 12.3877 13.2375L12.3636 13.3943L12.3393 13.5597C12.2416 14.2428 12.2453 14.5012 12.5589 14.8308C13.8241 16.1582 14.582 17.115 14.8116 17.6746C14.9237 17.9484 15.2119 18.7751 15.0136 19.5927C16.2372 19.1066 17.3156 18.3332 18.1653 17.3559C18.2755 16.9821 18.3551 16.5166 18.3551 15.9518V15.8472C18.3551 14.9247 18.3551 14.504 17.7031 14.1314C17.428 13.9751 17.2227 13.881 17.0582 13.8064C16.691 13.6394 16.4479 13.5297 16.1198 13.0499C16.0807 12.9928 16.0425 12.9358 16.0043 12.8777ZM12 3.83333C9.68259 3.83333 7.59062 4.79858 6.1042 6.34896C6.28116 6.47186 6.43537 6.64453 6.54129 6.88256C6.74529 7.34029 6.74529 7.8112 6.74529 8.22764C6.74488 8.55621 6.74442 8.8672 6.84992 9.09302C6.99443 9.40134 7.6164 9.53227 8.16548 9.64736C8.36166 9.68867 8.56395 9.73083 8.74797 9.78176C9.25405 9.92233 9.64554 10.3765 9.95938 10.7412C10.0896 10.8931 10.2819 11.1163 10.3783 11.1717C10.4286 11.1356 10.59 10.9608 10.6699 10.6735C10.7307 10.4547 10.7134 10.2597 10.6239 10.1543C10.0648 9.49445 10.0952 8.2232 10.268 7.75495C10.5402 7.01606 11.3905 7.07058 12.012 7.11097C12.2438 7.12589 12.4626 7.14023 12.6257 7.11976C13.2482 7.04166 13.4396 6.09538 13.575 5.91C13.8671 5.50981 14.7607 4.9071 15.3158 4.53454C14.3025 4.08382 13.1805 3.83333 12 3.83333Z\"/>"};
const TAROT_ARCANA=[{n:"愚者",r:"0",up:"新的开始·冒险·纯真",rev:"鲁莽·犹豫·逃避"},{n:"魔术师",r:"I",up:"创造·行动·掌控",rev:"欺瞒·空谈·失焦"},{n:"女祭司",r:"II",up:"直觉·潜意识·神秘",rev:"压抑·表里不一"},{n:"皇后",r:"III",up:"丰饶·滋养·感官",rev:"依赖·停滞·空虚"},{n:"皇帝",r:"IV",up:"权威·秩序·稳定",rev:"专断·僵化·失控"},{n:"教皇",r:"V",up:"传统·信念·指引",rev:"固执·教条·叛逆"},{n:"恋人",r:"VI",up:"结合·和谐·抉择",rev:"失衡·诱惑·分歧"},{n:"战车",r:"VII",up:"意志·胜利·前行",rev:"失向·内耗·急躁"},{n:"力量",r:"VIII",up:"勇气·耐心·内在力",rev:"自我怀疑·失控"},{n:"隐者",r:"IX",up:"内省·独处·寻道",rev:"孤立·退缩·迷失"},{n:"命运之轮",r:"X",up:"转机·循环·时运",rev:"逆流·停滞·意外"},{n:"正义",r:"XI",up:"公正·因果·平衡",rev:"偏颇·失责·失衡"},{n:"倒吊人",r:"XII",up:"放下·换视角·等待",rev:"徒劳·抗拒·拖延"},{n:"死神",r:"XIII",up:"结束·转化·重生",rev:"滞留·恐惧改变"},{n:"节制",r:"XIV",up:"调和·耐心·中道",rev:"失衡·过度·内耗"},{n:"恶魔",r:"XV",up:"束缚·欲望·执着",rev:"松绑·觉察·解脱"},{n:"高塔",r:"XVI",up:"突变·崩解·觉醒",rev:"延后的崩塌·抗拒"},{n:"星星",r:"XVII",up:"希望·灵感·疗愈",rev:"失望·怀疑·枯竭"},{n:"月亮",r:"XVIII",up:"潜意识·幻象·不安",rev:"迷雾渐散·释怀"},{n:"太阳",r:"XIX",up:"喜悦·成功·活力",rev:"短暂低落·过度乐观"},{n:"审判",r:"XX",up:"觉醒·召唤·清算",rev:"自责·逃避·停顿"},{n:"世界",r:"XXI",up:"圆满·完成·整合",rev:"未竟·差一步·拖延"}];
// ── 四种牌阵：单张 / 三张入门 / 五张两难抉择 / 凯尔特十字（十张，最经典的全面牌阵）──
const TAROT_SPREADS={
  1:{name:'单张 · 今日指引',pos:['今日指引']},
  3:{name:'三张 · 过去现在未来',pos:['过去','现在','未来']},
  5:{name:'五张 · 两难抉择',pos:['现状','选择A','A的发展','选择B','B的发展']},
  10:{name:'凯尔特十字',pos:['现状','挑战','目标','根基','过去','未来','自身','环境','期盼','结局']}
};
const _ttRaf=(typeof requestAnimationFrame==='function')?requestAnimationFrame:(fn)=>setTimeout(fn,16);   // 冒烟桩环境没有 rAF，兜底成 setTimeout
// ── 塔罗背景乐：渐入、循环、关窗渐出。音量压得低（0.16），够营造氛围但不抢戏 ──
const TT_BGM_VOL=0.16;
let _ttBgmCtx=null,_ttBgmBuf=null,_ttBgmSrc=null,_ttBgmGain=null,_ttBgmLoading=false;
function _ttEnsureCtx(){
  if(!_ttBgmCtx){try{_ttBgmCtx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  return _ttBgmCtx;
}
async function _ttLoadBgm(){
  if(_ttBgmBuf||_ttBgmLoading)return;
  _ttBgmLoading=true;
  try{
    const ctx=_ttEnsureCtx();if(!ctx)throw new Error('no audio ctx');
    const res=await fetch('/api/sfx/tarot-bgm');
    if(!res.ok)throw new Error('no bgm file');
    const arr=await res.arrayBuffer();
    _ttBgmBuf=await ctx.decodeAudioData(arr);
  }catch(e){_ttBgmBuf=null;}
  _ttBgmLoading=false;
}
async function ttBgmStart(){
  await _ttLoadBgm();
  const ctx=_ttBgmCtx;if(!ctx||!_ttBgmBuf)return;   // 没拿到文件就安静跳过，不影响抽牌本身
  if(ctx.state==='suspended'){try{await ctx.resume();}catch(e){}}
  ttBgmStop(true);   // 先掐掉可能还没淡出完的上一轮，避免叠两层音
  const src=ctx.createBufferSource();src.buffer=_ttBgmBuf;src.loop=true;
  const gain=ctx.createGain();gain.gain.value=0;
  src.connect(gain);gain.connect(ctx.destination);
  const now=ctx.currentTime;
  gain.gain.setValueAtTime(0,now);
  gain.gain.linearRampToValueAtTime(TT_BGM_VOL,now+2.4);   // 渐入 2.4s，慢慢浮出来才有神秘感，不是一开门就炸响
  try{src.start();}catch(e){return;}
  _ttBgmSrc=src;_ttBgmGain=gain;
}
function ttBgmStop(immediate){
  if(!_ttBgmSrc||!_ttBgmGain||!_ttBgmCtx){return;}
  const src=_ttBgmSrc,gain=_ttBgmGain,ctx=_ttBgmCtx;
  _ttBgmSrc=null;_ttBgmGain=null;
  if(immediate){try{src.stop();}catch(e){}return;}
  const now=ctx.currentTime;
  try{
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value,now);
    gain.gain.linearRampToValueAtTime(0,now+0.8);
  }catch(e){}
  setTimeout(()=>{try{src.stop();}catch(e){}},850);
}
const TT_STEP=10, TT_R=150, TT_VIS=74, TT_PULL=72;   // 扇距/半径/可见半角/拖出阈值(px)
let ttMode=1, ttDeck=[], ttPicks=[], ttEls=[], ttRot=0, ttVel=0, ttRaf=0;
// 指针状态机：idle → press →（横滑）rotate /（中间牌下拉）pull
let tt={st:'idle',pid:null,x0:0,y0:0,lx:0,lt:0,pullEl:null,pullIdx:-1,armed:false};

function openTarot(){
  const box=document.getElementById('qtarot');if(!box)return;
  box.style.display='block';_ttRaf(()=>box.classList.add('on'));
  ttSetMode(ttMode||1,true);
  ttBindOnce();
  ttBgmStart();
}
function closeTarot(){
  const box=document.getElementById('qtarot');if(!box)return;
  ttBgmStop();
  box.classList.remove('on');setTimeout(()=>{box.style.display='none';},280);
  cancelAnimationFrame(ttRaf);tt.st='idle';
}
function ttSetMode(n,force){
  if(!force&&ttMode===n&&ttPicks.length===0)return;
  ttMode=n;ttPicks=[];ttRot=0;ttVel=0;tt.st='idle';
  document.querySelectorAll('#qtarot .tt-modes button').forEach(b=>b.classList.toggle('on',+b.dataset.m===n));
  // 洗牌：每一轮（打开/换牌阵/再抽一次）Fisher–Yates 重洗；一轮之内从同一副洗好的牌里
  // 逐张抽、不放回、不补洗——和实体塔罗一个规矩。扇位→哪张牌因此每轮都是随机的。
  ttDeck=TAROT_ARCANA.map((_,i)=>i);
  for(let i=ttDeck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=ttDeck[i];ttDeck[i]=ttDeck[j];ttDeck[j]=t;}
  ttRot=-Math.floor(ttDeck.length/2)*TT_STEP;   // 开局把扇转到中段，左右都有牌可滑
  ttBuildSlots();                               // 抽之前先把牌阵的"坑位"摆出来（魔法阵里该在哪就在哪）
  const act=document.getElementById('tt-act');if(act)act.style.display='none';
  ttShuffleFan();                                // 帅气的洗牌动画：先聚成一叠抖两下，再摊成扇
}
// ── 牌阵坑位：抽之前就把每个位置的空槽摆出来，抽完的牌直接落进它该在的坑，不再"抽完不知道摆哪" ──
function ttBuildSlots(){
  const res=document.getElementById('tt-result');if(!res)return;
  res.innerHTML='';res.classList.toggle('tt-grid',ttMode===10);
  const big=ttMode===1,mini=ttMode===10;
  const mkSlot=(p,i)=>{
    const d=document.createElement('div');
    d.className='tt-rc tt-slot'+(big?' tt-big':'')+(mini?' tt-mini':'');
    d.id='tt-slot-'+i;
    d.innerHTML='<span class="tt-pos">'+p+'</span><div class="tt-in"><div class="tt-b tt-b-empty"></div></div>';
    return d;
  };
  if(ttMode===10){
    // 凯尔特十字传统摆法：中间十字（现状/挑战叠放+目标/根基/过去/未来）+ 右侧纵列四张（自身/环境/期盼/结局）
    // 不是随便一个格子摆一张——阵型本身就是解读的一部分，位置摆对了看起来才像正经在起局。
    const cross=document.createElement('div');cross.id='tt-cross';
    const staff=document.createElement('div');staff.id='tt-staff';
    TAROT_SPREADS[10].pos.forEach((p,i)=>{
      const el=mkSlot(p,i);
      (i<=5?cross:staff).appendChild(el);
    });
    res.appendChild(cross);res.appendChild(staff);
    return;
  }
  TAROT_SPREADS[ttMode].pos.forEach((p,i)=>res.appendChild(mkSlot(p,i)));
}
function ttBuildFan(){
  const fan=document.getElementById('tt-fan');if(!fan)return;
  fan.innerHTML='';ttEls=[];
  ttDeck.forEach(()=>{
    const el=document.createElement('div');el.className='tt-card';
    el.innerHTML='<div class="tt-back"></div>';
    fan.appendChild(el);ttEls.push(el);
  });
  ttLayout();
}
// v4.6：帅气的洗牌动画——牌先聚成一沓（略乱、像刚抓在手里），整叠"手腕一抖"晃两下，
// 然后每张牌错开一点延迟依次摊回扇形位置，看起来像刚洗完牌正在摆开，而不是瞬间贴好。
function ttShuffleFan(){
  const fan=document.getElementById('tt-fan'),zone=document.getElementById('tt-zone');if(!fan)return;
  fan.innerHTML='';ttEls=[];
  ttDeck.forEach((_,i)=>{
    const el=document.createElement('div');el.className='tt-card';
    el.innerHTML='<div class="tt-back"></div>';
    const jig=((i%7)-3)*1.3, rot=((i%5)-2)*3.4;   // 一沓牌略乱堆叠，不是齐刷刷的一条线
    el.style.opacity='0';
    el.style.transform='translate('+jig.toFixed(1)+'px,'+(i*0.32).toFixed(1)+'px) rotate('+rot.toFixed(1)+'deg) scale(.64)';
    el.style.zIndex=String(i);
    fan.appendChild(el);ttEls.push(el);
  });
  if(zone){zone.classList.remove('tt-shuffling');void zone.offsetWidth;zone.classList.add('tt-shuffling');}
  _ttRaf(()=>{ttEls.forEach(el=>{el.style.transition='opacity .16s ease';el.style.opacity='1';});});
  setTimeout(()=>{
    if(zone)zone.classList.remove('tt-shuffling');
    const ci=ttCenterIdx();
    ttEls.forEach((el,i)=>{
      el.style.transition='transform .52s cubic-bezier(.2,.85,.3,1.05) '+(Math.min(i,21)*15)+'ms,opacity .3s ease';
      ttApplyPos(el,i,ci);
    });
    setTimeout(()=>{ttEls.forEach(el=>{if(el)el.style.transition='';});},1000);
  },540);
}
function ttRotMin(){return -(Math.max(ttDeck.length,1)-1)*TT_STEP;}
function ttClampRot(v){return Math.max(ttRotMin(),Math.min(0,v));}
function ttCenterIdx(){const N=ttDeck.length;if(!N)return -1;return Math.max(0,Math.min(N-1,Math.round(-ttRot/TT_STEP)));}
function ttApplyPos(el,i,ci){   // 把第 i 张放回它的扇位；返回是否可见
  const a=i*TT_STEP+ttRot;      // 扇是一段弧，不做 ±180 环绕——22 张首尾相接成环才是之前扇形错乱的根
  if(Math.abs(a)>TT_VIS){el.style.display='none';return false;}
  el.style.display='block';
  const rad=a*Math.PI/180;
  const x=TT_R*Math.sin(rad), y=-TT_R*(1-Math.cos(rad));   // 下半圆：中间最低，两侧翘起
  const t=Math.abs(a)/TT_VIS;
  const sc=1.12-0.4*t, z=Math.round(1000-Math.abs(a)*9), op=Math.abs(a)>60?(1-(Math.abs(a)-60)/14):1;
  el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) rotate('+a.toFixed(1)+'deg) scale('+sc.toFixed(3)+')';
  el.style.zIndex=z;el.style.opacity=op.toFixed(2);
  el.classList.toggle('tt-sel',i===ci);
  return true;
}
function ttLayout(){
  const N=ttDeck.length,ci=ttCenterIdx();
  for(let i=0;i<N;i++){
    const el=ttEls[i];if(!el||el===tt.pullEl)continue;   // 被拖出的那张自己管自己
    el.style.transition='';
    ttApplyPos(el,i,ci);
  }
}
function ttNorm(d){while(d>180)d-=360;while(d<-180)d+=360;return d;}
function ttSnap(){
  const N=ttDeck.length;if(!N)return;
  const target=-ttCenterIdx()*TT_STEP;
  const from=ttRot,delta=target-from,t0=performance.now(),dur=240;
  (function ease(){const k=Math.min((performance.now()-t0)/dur,1),e=1-Math.pow(1-k,3);
    ttRot=from+delta*e;ttLayout();if(k<1)ttRaf=_ttRaf(ease);else ttRot=target;})();
}
function ttSpin(){
  ttRot+=ttVel;ttVel*=0.945;
  const c=ttClampRot(ttRot);
  if(c!==ttRot){ttRot=c;ttVel=0;}   // 甩到头就停在头，不会绕到背面去
  ttLayout();
  if(Math.abs(ttVel)>0.15)ttRaf=_ttRaf(ttSpin);else ttSnap();
}
// ── 指针交互：只有按住才动；pointercancel / 丢 mouseup 一律安全复位，绝不误抽 ──
let _ttBound=false;
function ttBindOnce(){
  if(_ttBound)return;_ttBound=true;
  const zone=document.getElementById('tt-zone');if(!zone||!zone.addEventListener)return;
  // 禁掉原生选区/拖拽——浏览器把手势升级成原生 drag 再发 pointercancel，就是 demo 时代"没按也晃"的元凶之一
  ['selectstart','dragstart','contextmenu'].forEach(ev=>zone.addEventListener(ev,e=>e.preventDefault()));
  zone.addEventListener('pointerdown',ttDown);
  window.addEventListener('pointermove',ttMove,{passive:false});
  window.addEventListener('pointerup',ttUp);
  window.addEventListener('pointercancel',ttCancel);
  window.addEventListener('blur',ttCancel);
}
function ttDown(e){
  if(tt.st!=='idle'||ttPicks.length>=ttMode||!ttDeck.length)return;
  cancelAnimationFrame(ttRaf);
  tt.st='press';tt.pid=e.pointerId;tt.x0=tt.lx=e.clientX;tt.y0=e.clientY;tt.lt=performance.now();ttVel=0;
  const ci=ttCenterIdx();
  tt.pullIdx=(ttEls[ci]&&(e.target===ttEls[ci]||ttEls[ci].contains&&ttEls[ci].contains(e.target)))?ci:-1;
  try{e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId);}catch(_){}
}
function ttMove(e){
  if(tt.st==='idle'||e.pointerId!==tt.pid)return;
  // 按键状态实时校验：鼠标丢了 mouseup（窗口外松开等），buttons 会归零——立即当作松手，杜绝"不按也跟手"
  if(e.pointerType==='mouse'&&e.buttons===0){ttCancel(e);return;}
  e.preventDefault();
  const dx=e.clientX-tt.x0, dy=e.clientY-tt.y0;
  if(tt.st==='press'){
    if(tt.pullIdx>=0&&dy>12&&Math.abs(dy)>Math.abs(dx)*1.2){   // 中间牌向下拖出 → 进入抽牌拖拽
      tt.st='pull';tt.pullEl=ttEls[tt.pullIdx];tt.armed=false;
      tt.pullEl.classList.add('tt-pulling');tt.pullEl.style.zIndex=1200;
    }else if(Math.abs(dx)>6){tt.st='rotate';}
    else return;
  }
  if(tt.st==='rotate'){
    const x=e.clientX,t=performance.now(),ddx=x-tt.lx,dt=Math.max(t-tt.lt,8);
    ttRot=ttClampRot(ttRot+ddx*0.3);ttVel=ddx*0.3/dt*16;tt.lx=x;tt.lt=t;ttLayout();
  }else if(tt.st==='pull'&&tt.pullEl){
    const px=dx,py=Math.max(0,dy);
    const armed=py>=TT_PULL;
    if(armed!==tt.armed){tt.armed=armed;tt.pullEl.classList.toggle('tt-armed',armed);}
    tt.pullEl.style.transition='none';
    tt.pullEl.style.transform='translate('+px.toFixed(1)+'px,'+py.toFixed(1)+'px) rotate(0deg) scale(1.16)';
  }
}
function ttUp(e){
  if(tt.st==='idle'||e.pointerId!==tt.pid)return;
  const st=tt.st;tt.st='idle';tt.pid=null;
  if(st==='rotate'){ttSpin();return;}
  if(st==='pull'){
    if(tt.armed)ttDrawPulled();else ttSpringBack();
    return;
  }
  // 轻点（press 没升级）：不抽、不动——demo 验收口径
}
function ttCancel(e){
  if(tt.st==='idle')return;
  const st=tt.st;tt.st='idle';tt.pid=null;
  if(st==='pull')ttSpringBack();       // pointercancel 永远不算抽
  else if(st==='rotate')ttSnap();
}
function ttSpringBack(){
  const el=tt.pullEl,i=tt.pullIdx;
  tt.pullEl=null;tt.pullIdx=-1;tt.armed=false;
  if(!el)return;
  el.classList.remove('tt-armed','tt-pulling');
  el.style.transition='transform .38s cubic-bezier(.2,1.6,.35,1)';   // 弹簧回位
  ttApplyPos(el,i,ttCenterIdx());                                    // 单写这一张，不走 ttLayout（那会清掉过渡）
  setTimeout(()=>{if(el)el.style.transition='';},420);
}
function ttDrawPulled(){
  const i=tt.pullIdx,el=tt.pullEl;
  tt.pullEl=null;tt.pullIdx=-1;tt.armed=false;
  if(i<0||!ttDeck.length)return;
  const cardIdx=ttDeck[i],card=TAROT_ARCANA[cardIdx],reversed=Math.random()<0.35;
  ttPicks.push({card,reversed,pos:TAROT_SPREADS[ttMode].pos[ttPicks.length]});
  if(el&&el.remove)el.remove();
  ttDeck.splice(i,1);ttEls.splice(i,1);
  ttRot=ttClampRot(ttRot);
  ttLayout();ttSnap();                                               // 剩下的自动转正补位
  ttReveal(ttPicks[ttPicks.length-1],ttPicks.length-1);
  if(ttPicks.length>=ttMode){
    const act=document.getElementById('tt-act');if(act)act.style.display='block';
  }
}
function ttIconSvg(name,rev,sz){sz=sz||40;return '<svg viewBox="0 0 24 24" width="'+sz+'" height="'+sz+'" fill="currentColor" style="'+(rev?'transform:rotate(180deg)':'')+'">'+(TAROT_ICON[name]||'')+'</svg>';}
function ttReveal(p,slotIdx){
  const slot=document.getElementById('tt-slot-'+slotIdx);if(!slot)return;
  const big=ttMode===1, sz=ttMode===10?26:(big?46:36);
  slot.classList.remove('tt-slot');
  if(p.reversed)slot.classList.add('tt-rev');
  slot.innerHTML='<span class="tt-pos">'+p.pos+'</span>'+
    '<div class="tt-in"><div class="tt-b"></div>'+
    '<div class="tt-f"><span class="tt-num">'+p.card.r+'</span><span class="tt-sym">'+ttIconSvg(p.card.n,p.reversed,sz)+'</span>'+
    '<span class="tt-nm">'+p.card.n+(p.reversed?'·逆':'')+'</span><span class="tt-kw">'+(p.reversed?p.card.rev:p.card.up)+'</span></div></div>';
  _ttRaf(()=>slot.classList.add('tt-landed'));
  setTimeout(()=>slot.classList.add('tt-flip'),80);
}
function ttAgain(){ttSetMode(ttMode,true);}
function ttSend(){
  if(!ttPicks.length)return;
  const sp=TAROT_SPREADS[ttMode];
  const lines=ttPicks.map(p=>'「'+p.pos+'」'+p.card.n+(p.reversed?'（逆位）':'（正位）')+'——'+(p.reversed?p.card.rev:p.card.up));
  // v4.6.5：塔罗不结合八字/黄历了——那是每日一签的中式玄学范畴，塔罗走西方传统，改成结合生日；
  // 也不再直接自动发出去，改成填进输入框，让你把"今天具体想问的事"补进去再自己点发送。
  const msg='我抽了塔罗·'+sp.name+'：\n'+lines.join('\n')+'\n请结合我的星座，把这组牌串起来帮我解读。';
  closeTarot();
  quillFill(msg);
}


