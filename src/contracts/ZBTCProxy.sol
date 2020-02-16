pragma solidity ^0.5.12;

interface IERC20 {
    function balanceOf   (address)                external view returns (uint256);
    function approve     (address, uint256)       external returns (bool);
    function transferFrom(address, address, uint) external returns (bool);
    function transfer    (address, uint256)       external returns (bool);
}

contract GemJoin {
    function join(address, uint) public;
    function exit(address, uint) public;
}

contract CdpManager {
    function open(bytes32, address) external returns (uint);
    function frob(uint, int, int) external;
    function move(uint, address, uint) external;
    function urns(uint) view external returns (address);
}

contract Vat {
    function hope(address usr) external;
}

contract DirectZBTCProxy {
    
    uint256 constant ONE  = 10 ** 27; // This is what MakerDAO uses.
    uint256 constant NORM = 10 ** 10; // This is the difference between 18 decimals in ERC20s and 8 decimals in BTC.
    
    IERC20 public zbtc; // zBTC.
    IERC20 public dai;  // Dai.
    
    bytes32    public ilk;
    CdpManager public manager;
    GemJoin    public daiGemJoin;
    GemJoin    public zbtcGemJoin;
    Vat        public daiVat;
    
    mapping (address => uint) cdpids;

    constructor(
        address _zbtc,
        address _dai,
    
        bytes32 _ilk,
        address _manager,
        address _daiGemJoin,
        address _zbtcGemJoin,
        address _daiVat
    ) public {
        zbtc = IERC20(_zbtc);
        dai  = IERC20(_dai);
        
        ilk         = _ilk;
        manager     = CdpManager(_manager);
        daiGemJoin  = GemJoin(_daiGemJoin);
        zbtcGemJoin = GemJoin(_zbtcGemJoin);
        daiVat      = Vat(_daiVat);
    }
    
    function borrow(
        address _owner, // CDP owner (if they do not own a CDP, one will be created).
        int     _dink,  // Amount of zBTC to collateralize (18 decimals).
        int     _dart   // Amount of Dai to borrow (18 decimals).
    ) external {
        require(_owner != address(this), "err self-reference");
        require(_dink >= 0, "err negative dink");
        require(_dart >= 0, "err negative dart");
        
        // Create CDP
        uint cdpid = cdpids[_owner];
        if (cdpids[_owner] == 0) {
            cdpid = manager.open(ilk, address(this));
            cdpids[_owner] = cdpid;
        }
        
        // Join zBTC into the gem
        require(zbtc.transferFrom(_owner, address(this), uint(_dink)/NORM), "err transferFrom: zbtc");
        require(zbtc.approve(address(zbtcGemJoin), uint(_dink)/NORM), "err approve: zbtc");
        zbtcGemJoin.join(manager.urns(cdpid), uint(_dink)/NORM);

        manager.frob(cdpid, _dink, _dart);
        manager.move(cdpid, address(this), uint(_dart) * ONE);
        daiVat.hope(address(daiGemJoin));
        daiGemJoin.exit(_owner, uint(_dart));
    }
    
    function repay(
        address _owner, // CDP owner
        int     _dink,  // Amount of zBTC to reclaim (with 18 decimal places).
        int     _dart   // Amount of Dai to repay
    ) external {
        require(_owner != address(this), "err self-reference");
        require(_dink >= 0, "err negative dink");
        require(_dart >= 0, "err negative dart");
        
        uint cdpid = cdpids[_owner];
        require(cdpid != 0, "err cdp: not found");
        
        // Join Dai into the gem
        require(dai.transferFrom(_owner, address(this), uint(_dart)), "err transferFrom: dai");
        require(dai.approve(address(daiGemJoin), uint(_dart)), "err approve: dai");
        daiGemJoin.join(manager.urns(cdpid), uint(_dart));
        
        // Lower the debt and exit some collateral
        manager.frob(cdpid, -_dink, -_dart);
        zbtcGemJoin.exit(_owner, uint(_dink)/NORM);
    }
}