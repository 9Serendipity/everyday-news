window.POLICY_FEED = {
  mode: "demo",
  aiEnabled: false,
  sources: [
    { id: "gov", name: "中国政府网", shortName: "中国政府网", url: "https://www.gov.cn/zhengce/zuixin/", status: "demo" },
    { id: "ndrc", name: "国家发展和改革委员会", shortName: "国家发改委", url: "https://www.ndrc.gov.cn/xwdt/xwfb/wap_index.html", status: "demo" },
    { id: "pbc", name: "中国人民银行", shortName: "人民银行", url: "https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/index.html", status: "demo" },
    { id: "csrc", name: "中国证券监督管理委员会", shortName: "证监会", url: "https://www.csrc.gov.cn/csrc/c100028/common_xq_list.shtml?tab=02", status: "demo" },
    { id: "nda", name: "国家数据局", shortName: "国家数据局", url: "https://www.nda.gov.cn/sjj/zwgk/tzgg/list/index_pc_1.html", status: "demo" }
  ],
  items: [
    {
      id: "demo-market",
      sourceId: "pbc",
      day: "2026-11-20",
      title: "2026年10月金融市场运行情况",
      url: "https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/2026112015225760018/index.html",
      category: "货币与金融",
      excerpt: "人民银行发布当月金融市场运行情况，涵盖债券市场、货币市场等主要领域。",
      analysis: {
        origin: "demo",
        direction: "neutral",
        summary: "人民银行发布月度金融市场统计，披露债券发行和货币市场交易等情况。",
        industries: ["银行", "非银金融"],
        impact: "月度统计可以用于观察市场融资和流动性变化。单月数据宜结合前期数据比较。",
        watch: ["债券发行和交易规模的变化", "后续货币市场月度数据"]
      }
    },
    {
      id: "demo-cases",
      sourceId: "csrc",
      day: "2026-11-20",
      title: "证券监管部门联合公安机关依法处罚编造传播资本市场虚假信息行为，公布4起典型案例",
      url: "https://www.csrc.gov.cn/csrc/c100028/c7671953/content.shtml",
      category: "资本市场",
      excerpt: "证监会发布四起涉及编造、传播资本市场虚假信息的典型案例。",
      analysis: {
        origin: "demo",
        direction: "unclear",
        summary: "监管部门公布四起资本市场虚假信息案件，展示了典型情形和处置方式。",
        industries: ["非银金融"],
        impact: "案例集中反映信息传播合规要求，直接行业影响仍需结合具体业务判断。",
        watch: ["后续监管案例及相关规则"]
      }
    },
    {
      id: "demo-bank",
      sourceId: "pbc",
      day: "2026-11-20",
      title: "中国人民银行行长潘功胜会见万事达卡首席执行官孟轲",
      url: "https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/2026112018344539698/index.html",
      category: "货币与金融",
      excerpt: "人民银行公开了行长潘功胜与万事达卡首席执行官的会见信息。"
    },
    {
      id: "demo-data",
      sourceId: "nda",
      day: "2026-11-18",
      title: "国家数据局综合司关于组织开展第二批可信数据空间创新发展试点工作的通知",
      url: "https://www.nda.gov.cn/sjj/zwgk/tzgg/1118/20261118203149832876736_pc.html",
      category: "数字经济",
      excerpt: "第二批试点包括企业、行业、城市三类可信数据空间，关注数据流通规则、应用场景及人工智能应用。",
      analysis: {
        origin: "demo",
        direction: "unclear",
        summary: "国家数据局启动第二批可信数据空间试点申报，涉及企业、行业和城市三类场景。",
        industries: ["计算机"],
        impact: "试点将为数据基础设施和应用提供验证场景。具体进展取决于入选项目和落地安排。",
        watch: ["试点名单", "建设与运营进展"]
      }
    },
    {
      id: "demo-ndrc",
      sourceId: "ndrc",
      day: "2026-11-17",
      title: "沈竹林副主任会见宝马集团董事长聂科维",
      url: "https://www.ndrc.gov.cn/xwdt/xwfb/202611/t20261117_1408916.html",
      category: "宏观与产业",
      excerpt: "国家发改委公开了与宝马集团的会见动态。"
    },
    {
      id: "demo-charity",
      sourceId: "gov",
      day: "2026-11-10",
      title: "基金会管理条例",
      url: "https://www.gov.cn/zhengce/content/202611/content_7085661.htm",
      category: "政策文件",
      excerpt: "中国政府网发布基金会管理条例，内容覆盖设立登记、运行管理和监督要求。"
    },
    {
      id: "demo-securities",
      sourceId: "csrc",
      day: "2025-12-06",
      title: "加快打造一流投资银行和投资机构，更好助推资本市场高质量发展",
      url: "https://www.csrc.gov.cn/csrc/c106311/c7600144/content.shtml",
      category: "资本市场",
      excerpt: "证监会公开了吴清在中国证券业协会第八次会员大会上的致辞，讨论证券行业高质量发展。",
      analysis: {
        origin: "demo",
        direction: "unclear",
        summary: "证监会主席在证券业协会会员大会上阐述证券机构服务投融资和推进行业高质量发展的方向。",
        industries: ["非银金融"],
        impact: "行业方向涉及专业能力、合规风控及差异化发展，仍需关注后续可执行政策。",
        watch: ["配套制度和行业规则"]
      }
    }
  ]
};
