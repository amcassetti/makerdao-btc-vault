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
    function flux(uint, address, uint) external;
}

contract Vat {
    function hope(address usr) external;
    function urns(bytes32, address) external returns (uint256, uint256);
}

contract Jug {
    function drip(bytes32 ilk) external returns (uint rate);
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
    Vat        public vat;
    Jug        public jug;
    
    mapping (address => uint) cdpids;

    constructor(
        address _zbtc,
        address _dai,
    
        bytes32 _ilk,
        address _manager,
        address _daiGemJoin,
        address _zbtcGemJoin,
        address _vat,
        address _jug
    ) public {
        zbtc = IERC20(_zbtc);
        dai  = IERC20(_dai);
        
        ilk         = _ilk;
        manager     = CdpManager(_manager);
        daiGemJoin  = GemJoin(_daiGemJoin);
        zbtcGemJoin = GemJoin(_zbtcGemJoin);
        vat         = Vat(_vat);
        jug         = Jug(_jug);
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
        vat.hope(address(daiGemJoin));
        daiGemJoin.exit(_owner, uint(_dart));
    }
    
    function repay(
        address _owner, // CDP owner
        uint    _wad,   // Amount of zBTC to reclaim (with 18 decimal places).
        uint    _dart
    ) external {
        require(_owner != address(this), "err self-reference");
        
        uint cdpid = cdpids[_owner];
        require(cdpid != 0, "err cdp: not found");
        
        // Join Dai into the gem
        require(dai.transferFrom(_owner, address(this), _dart), "err transferFrom: dai");
        require(dai.approve(address(daiGemJoin), _dart), "err approve: dai");
        daiGemJoin.join(manager.urns(cdpid), _dart);
        
        // Unlocks token amount from the CDP
        manager.frob(
            cdpid,
            -int(_wad),
            0
        );
        // Moves the amount from the CDP urn to proxy's address
        manager.flux(
            cdpid,
            address(this),
            _wad
        );
        // Exits token amount to the user's wallet as a token
        zbtcGemJoin.exit(_owner, _wad/NORM);
    }
}