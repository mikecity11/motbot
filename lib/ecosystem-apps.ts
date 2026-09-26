export type EcosystemStatus='integrated'|'next'|'discover';
export type EcosystemApp={name:string;category:string;description:string;status:EcosystemStatus};

const groups:Record<string,string[]>={
  'Trading & swaps':['Perpl','Kuru','Uniswap','PancakeSwap','Drake','LFJ','Clober','Blinq','LeverUp','KyberSwap','Capricorn','Matcha','GMGN','Nad.fun','Crystal','Monday Trade','Monorail','Dirol','Balancer','SushiSwap','1inch','Trendle','Curve','Bean Exchange','MevX','MemeTok','Nabla Finance','o1 exchange','WOOFi','Definitive','FereAI','OpenOcean','UniversalX','XStable','PLabs'],
  'Lending & yield':['FastLane','aPriori','Neverland','Aave','Pendle','Magma','Morpho','Kintsu','Beefy','TownSquare','Agora','Euler','Curvance','Upshift','Midas','Folks Finance','Covenant','Mellow','YieldApp','MetaMask Money','Lido','aarna','ApeBond','Axal','Gearbox','INFINIT','Lagoon','Multipli','Puffer','Renzo','RHEA Finance','Solv Protocol','Spectra','StakeMON.ad','StakeStone','Sumer Money','Tadle','Yuzu Money','Ethena','Saturn','Strata','CoinFello'],
  'Bridge & payments':['Relay','Mayan','Cashmere','PingMe','Across','Bungee','CCTP Exchange','deBridge','Hyperlane Nexus','Interport Finance','Jumper.Exchange','Matcha Meta','Stargate Finance','Symbiosis','Wormhole Portal','UR','USDC Bridge','AnomaPay'],
  'Social & consumer':['Collective Memory','OpenSea','Lumiterra','LootGO','Bro.fun','Farcaster','fomo','ACO Labs','Bidali','Call of Odin’s Chosen','Grimmy’s','Hyperstitions','Kizzy','MUKU','Narbet','Omnia','PlayKami','Rug Rumble','The Arena','Valor Quest','Oripa','CRSH Market','Levr'],
  'AI & data':['KINETK','Birdeye','dFusion AI','GeckoTerminal','Kinic AI','Nadradar','Noah AI','Nubila Network','PrismaX','Mona Trading Bot'],
  'Launch & staking':['Flap','Clanker World','BONAD','cp0x','Forest Staking','ITRocket','Silk Nodes','Staking with Synergy','Token Mill'],
};

const descriptions:Record<string,string>={
  Perpl:'Trade perpetual markets fully onchain.',Levr:'Sports and prediction markets on Monad.',Kuru:'A Monad-native trading hub and launchpad.',Uniswap:'Swap assets through the largest onchain marketplace.',Relay:'Swap and bridge assets across chains.',PingMe:'Send stablecoins as simply as sending a message.',OpenSea:'Discover and trade digital collectibles.',Lumiterra:'An AI-powered open-world game.','Collective Memory':'A decentralized memory and social layer.',FastLane:'Alignment-powered liquid staking.',Nadradar:'Explore activity and analytics across Monad.','Noah AI':'Build decentralized apps through conversation.',AnomaPay:'Private payments made easy.',Farcaster:'Discover, create and connect onchain.'
};
const next=new Set(['Levr','Kuru','Uniswap','Relay','PingMe','Nadradar']);

export const ecosystemApps:EcosystemApp[]=Object.entries(groups).flatMap(([category,names])=>names.map(name=>({
  name,category,description:descriptions[name]||`Explore ${name} through the Monad ecosystem.`,status:name==='Perpl'?'integrated':next.has(name)?'next':'discover'
})));

export const ecosystemCategories=['All',...Object.keys(groups)];
