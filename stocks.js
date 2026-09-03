/* 常用美股代码库 — 代码|中文名|英文名
   仅用于输入时的下拉联想，不影响任何计算；列表里没有的代码依然可以手动输入。 */
'use strict';

window.STOCKS = `
AAPL|苹果|Apple
MSFT|微软|Microsoft
NVDA|英伟达|NVIDIA
GOOGL|谷歌-A|Alphabet Class A
GOOG|谷歌-C|Alphabet Class C
AMZN|亚马逊|Amazon
META|Meta 平台|Meta Platforms
TSLA|特斯拉|Tesla
SPCX|太空探索技术|SpaceX
AVGO|博通|Broadcom
TSM|台积电|Taiwan Semiconductor
ORCL|甲骨文|Oracle
NFLX|奈飞|Netflix
AMD|超威半导体|Advanced Micro Devices
CRM|赛富时|Salesforce
ADBE|奥多比|Adobe
INTC|英特尔|Intel
QCOM|高通|Qualcomm
TXN|德州仪器|Texas Instruments
MU|美光科技|Micron Technology
AMAT|应用材料|Applied Materials
LRCX|泛林集团|Lam Research
KLAC|科天半导体|KLA Corporation
ADI|亚德诺半导体|Analog Devices
NXPI|恩智浦|NXP Semiconductors
MRVL|迈威尔科技|Marvell Technology
ON|安森美半导体|ON Semiconductor
SNPS|新思科技|Synopsys
CDNS|铿腾电子|Cadence Design
ARM|Arm 控股|Arm Holdings
ASML|阿斯麦|ASML Holding
SMCI|超微电脑|Super Micro Computer
DELL|戴尔科技|Dell Technologies
HPQ|惠普|HP Inc.
IBM|国际商业机器|IBM
CSCO|思科|Cisco Systems
ANET|Arista 网络|Arista Networks
NOW|ServiceNow|ServiceNow
INTU|财捷|Intuit
PANW|派拓网络|Palo Alto Networks
CRWD|CrowdStrike|CrowdStrike
ZS|Zscaler|Zscaler
FTNT|飞塔信息|Fortinet
NET|Cloudflare|Cloudflare
DDOG|Datadog|Datadog
SNOW|Snowflake|Snowflake
MDB|MongoDB|MongoDB
PLTR|Palantir|Palantir Technologies
U|Unity 软件|Unity Software
SHOP|Shopify|Shopify
XYZ|Block|Block Inc.
PYPL|贝宝|PayPal
UBER|优步|Uber Technologies
LYFT|来福车|Lyft
ABNB|爱彼迎|Airbnb
DASH|DoorDash|DoorDash
BKNG|缤客控股|Booking Holdings
EXPE|亿客行|Expedia Group
SPOT|声田|Spotify
DIS|迪士尼|Walt Disney
CMCSA|康卡斯特|Comcast
WBD|华纳兄弟探索|Warner Bros. Discovery
ROKU|Roku|Roku
TTD|Trade Desk|The Trade Desk
APP|AppLovin|AppLovin
RBLX|罗布乐思|Roblox
EA|艺电|Electronic Arts
TTWO|Take-Two|Take-Two Interactive
ZM|Zoom|Zoom Communications
DOCU|DocuSign|DocuSign
TEAM|Atlassian|Atlassian
WDAY|Workday|Workday
HUBS|HubSpot|HubSpot
TWLO|Twilio|Twilio
OKTA|Okta|Okta
BRK.B|伯克希尔-B|Berkshire Hathaway B
JPM|摩根大通|JPMorgan Chase
BAC|美国银行|Bank of America
WFC|富国银行|Wells Fargo
C|花旗集团|Citigroup
GS|高盛|Goldman Sachs
MS|摩根士丹利|Morgan Stanley
SCHW|嘉信理财|Charles Schwab
BLK|贝莱德|BlackRock
BX|黑石集团|Blackstone
KKR|KKR 集团|KKR & Co.
APO|阿波罗全球管理|Apollo Global
AXP|美国运通|American Express
V|维萨|Visa
MA|万事达|Mastercard
COF|第一资本|Capital One
PGR|前进保险|Progressive
TRV|旅行者保险|Travelers
ALL|好事达保险|Allstate
AIG|美国国际集团|AIG
MET|大都会人寿|MetLife
PRU|保德信金融|Prudential Financial
CB|安达保险|Chubb
MMC|威达信集团|Marsh & McLennan
AON|怡安集团|Aon
COIN|Coinbase|Coinbase Global
HOOD|罗宾汉|Robinhood Markets
SOFI|SoFi 科技|SoFi Technologies
LLY|礼来|Eli Lilly
UNH|联合健康|UnitedHealth Group
JNJ|强生|Johnson & Johnson
ABBV|艾伯维|AbbVie
MRK|默沙东|Merck & Co.
PFE|辉瑞|Pfizer
TMO|赛默飞世尔|Thermo Fisher Scientific
ABT|雅培|Abbott Laboratories
DHR|丹纳赫|Danaher
AMGN|安进|Amgen
BMY|百时美施贵宝|Bristol-Myers Squibb
GILD|吉利德科学|Gilead Sciences
VRTX|福泰制药|Vertex Pharmaceuticals
REGN|再生元制药|Regeneron
ISRG|直觉外科|Intuitive Surgical
SYK|史赛克|Stryker
BSX|波士顿科学|Boston Scientific
MDT|美敦力|Medtronic
CI|信诺集团|Cigna
CVS|西维斯健康|CVS Health
ELV|Elevance 健康|Elevance Health
HCA|HCA 医疗|HCA Healthcare
ZTS|硕腾|Zoetis
MRNA|莫德纳|Moderna
BIIB|渤健|Biogen
WMT|沃尔玛|Walmart
COST|好市多|Costco
TGT|塔吉特|Target
HD|家得宝|Home Depot
LOW|劳氏|Lowe's
PG|宝洁|Procter & Gamble
KO|可口可乐|Coca-Cola
PEP|百事可乐|PepsiCo
MCD|麦当劳|McDonald's
SBUX|星巴克|Starbucks
NKE|耐克|Nike
LULU|露露乐蒙|Lululemon
TJX|TJX 公司|TJX Companies
ROST|罗斯百货|Ross Stores
DG|达乐|Dollar General
DLTR|美元树|Dollar Tree
KR|克罗格|Kroger
MDLZ|亿滋国际|Mondelez
MO|奥驰亚|Altria Group
PM|菲利普莫里斯|Philip Morris
CL|高露洁|Colgate-Palmolive
KMB|金佰利|Kimberly-Clark
GIS|通用磨坊|General Mills
KHC|卡夫亨氏|Kraft Heinz
HSY|好时|Hershey
STZ|星座品牌|Constellation Brands
YUM|百胜餐饮|Yum! Brands
CMG|墨式烧烤|Chipotle
DPZ|达美乐披萨|Domino's Pizza
MAR|万豪国际|Marriott International
HLT|希尔顿|Hilton Worldwide
RCL|皇家加勒比邮轮|Royal Caribbean
CCL|嘉年华邮轮|Carnival
NCLH|挪威邮轮|Norwegian Cruise Line
LVS|拉斯维加斯金沙|Las Vegas Sands
MGM|美高梅|MGM Resorts
WYNN|永利度假村|Wynn Resorts
F|福特汽车|Ford Motor
GM|通用汽车|General Motors
RIVN|Rivian|Rivian Automotive
LCID|Lucid 汽车|Lucid Group
XOM|埃克森美孚|Exxon Mobil
CVX|雪佛龙|Chevron
COP|康菲石油|ConocoPhillips
SLB|斯伦贝谢|SLB
EOG|EOG 能源|EOG Resources
PSX|菲利普斯 66|Phillips 66
VLO|瓦莱罗能源|Valero Energy
MPC|马拉松石油|Marathon Petroleum
OXY|西方石油|Occidental Petroleum
KMI|金德摩根|Kinder Morgan
WMB|威廉姆斯|Williams Companies
BA|波音|Boeing
CAT|卡特彼勒|Caterpillar
DE|迪尔|Deere & Co.
HON|霍尼韦尔|Honeywell
GE|通用电气航空|GE Aerospace
RTX|雷神技术|RTX Corporation
LMT|洛克希德马丁|Lockheed Martin
NOC|诺斯罗普格鲁曼|Northrop Grumman
GD|通用动力|General Dynamics
MMM|3M 公司|3M
UPS|联合包裹|United Parcel Service
FDX|联邦快递|FedEx
UNP|联合太平洋|Union Pacific
CSX|CSX 运输|CSX Corporation
NSC|诺福克南方|Norfolk Southern
DAL|达美航空|Delta Air Lines
UAL|联合航空|United Airlines
AAL|美国航空|American Airlines
LUV|西南航空|Southwest Airlines
EMR|艾默生电气|Emerson Electric
ETN|伊顿|Eaton
ITW|伊利诺伊工具|Illinois Tool Works
PH|派克汉尼汾|Parker Hannifin
URI|联合租赁|United Rentals
LIN|林德|Linde
SHW|宣伟涂料|Sherwin-Williams
APD|空气化工产品|Air Products
ECL|艺康|Ecolab
NEM|纽蒙特矿业|Newmont
FCX|自由港麦克莫兰|Freeport-McMoRan
NUE|纽柯钢铁|Nucor
DOW|陶氏化学|Dow Inc.
DD|杜邦|DuPont
T|美国电话电报|AT&T
VZ|威瑞森|Verizon
TMUS|T-Mobile|T-Mobile US
NEE|新纪元能源|NextEra Energy
DUK|杜克能源|Duke Energy
SO|南方公司|Southern Company
D|道明尼能源|Dominion Energy
AEP|美国电力|American Electric Power
EXC|爱克斯龙|Exelon
SRE|桑普拉能源|Sempra
AMT|美国电塔|American Tower
PLD|安博|Prologis
EQIX|Equinix|Equinix
SPG|西蒙地产|Simon Property Group
O|房地产收入|Realty Income
CCI|冠城国际|Crown Castle
BABA|阿里巴巴|Alibaba Group
PDD|拼多多|PDD Holdings
JD|京东|JD.com
BIDU|百度|Baidu
NTES|网易|NetEase
TCOM|携程|Trip.com Group
TME|腾讯音乐|Tencent Music
BILI|哔哩哔哩|Bilibili
NIO|蔚来|NIO Inc.
XPEV|小鹏汽车|XPeng
LI|理想汽车|Li Auto
ZTO|中通快递|ZTO Express
YUMC|百胜中国|Yum China
BEKE|贝壳找房|KE Holdings
FUTU|富途控股|Futu Holdings
TIGR|老虎证券|UP Fintech
IQ|爱奇艺|iQIYI
VIPS|唯品会|Vipshop
ATHM|汽车之家|Autohome
HTHT|华住集团|H World Group
EDU|新东方|New Oriental Education
TAL|好未来|TAL Education
ZLAB|再鼎医药|Zai Lab
BGNE|百济神州|BeiGene
QFIN|奇富科技|Qifu Technology
DQ|大全新能源|Daqo New Energy
JKS|晶科能源|JinkoSolar
SPY|标普500 ETF|SPDR S&P 500 ETF
QQQ|纳指100 ETF|Invesco QQQ Trust
VOO|先锋标普500 ETF|Vanguard S&P 500 ETF
VTI|先锋全市场 ETF|Vanguard Total Stock Market
IVV|安硕标普500 ETF|iShares Core S&P 500
DIA|道琼斯 ETF|SPDR Dow Jones ETF
IWM|罗素2000 ETF|iShares Russell 2000
VEA|先锋发达市场 ETF|Vanguard Developed Markets
VXUS|先锋国际股票 ETF|Vanguard Total International
ARKK|方舟创新 ETF|ARK Innovation ETF
SOXX|半导体 ETF|iShares Semiconductor ETF
SMH|半导体 ETF|VanEck Semiconductor ETF
XLK|科技板块 ETF|Technology Select Sector
XLF|金融板块 ETF|Financial Select Sector
XLE|能源板块 ETF|Energy Select Sector
XLV|医疗板块 ETF|Health Care Select Sector
XLY|可选消费 ETF|Consumer Discretionary Select
XLP|日常消费 ETF|Consumer Staples Select
XLI|工业板块 ETF|Industrial Select Sector
TLT|20年期美债 ETF|iShares 20+ Year Treasury
IEF|7-10年美债 ETF|iShares 7-10 Year Treasury
SHY|1-3年美债 ETF|iShares 1-3 Year Treasury
GLD|黄金 ETF|SPDR Gold Shares
IAU|黄金 ETF|iShares Gold Trust
SLV|白银 ETF|iShares Silver Trust
USO|原油 ETF|United States Oil Fund
VNQ|房地产 ETF|Vanguard Real Estate
EEM|新兴市场 ETF|iShares MSCI Emerging Markets
FXI|中国大盘 ETF|iShares China Large-Cap
KWEB|中概互联网 ETF|KraneShares CSI Internet
MCHI|MSCI中国 ETF|iShares MSCI China
TQQQ|三倍做多纳指|ProShares UltraPro QQQ
SQQQ|三倍做空纳指|ProShares UltraPro Short QQQ
SOXL|三倍做多半导体|Direxion Semiconductor Bull 3X
TMF|三倍做多长债|Direxion 20+ Treasury Bull 3X
UVXY|波动率 ETF|ProShares Ultra VIX
VXX|波动率 ETN|iPath Series B VIX
BITO|比特币期货 ETF|ProShares Bitcoin Strategy
IBIT|贝莱德比特币 ETF|iShares Bitcoin Trust
FBTC|富达比特币 ETF|Fidelity Wise Origin Bitcoin
GBTC|灰度比特币信托|Grayscale Bitcoin Trust
MSTR|微策略|MicroStrategy
MARA|Marathon 数字|MARA Holdings
RIOT|Riot 平台|Riot Platforms
`.trim().split('\n').map((l) => {
  const [s, c, e] = l.split('|');
  return { s, c, e };
});
