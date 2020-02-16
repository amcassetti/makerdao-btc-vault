import { createMuiTheme } from '@material-ui/core/styles';
import blueGrey from '@material-ui/core/colors/blueGrey';
import grey from '@material-ui/core/colors/grey';

export default createMuiTheme({
    typography: {
        fontFamily: [
            'Overpass',
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
            '"Apple Color Emoji"',
            '"Segoe UI Emoji"',
            '"Segoe UI Symbol"',
        ].join(',')
    },
    palette: {
        primary: {
            light: '#000',
            main: '#000',
            dark: '#000',
            contrastText: '#fff',
        },
        // primary: blueGrey,
        secondary: grey,
    },
    overrides: {
        MuiButton: {
            root: {
                textTransform: 'none'
            }
          // // Name of the rule
          // text: {
          //   // Some CSS
          //   color: 'white',
          // },
        },
        PrivateNotchedOutline: {
            root: {
            }
        },
        // '.MuiOutlinedInput-root:hover':{
        //     borderColor: '#EBEBEB !important'
        // },
        MuiOutlinedInput: {
            // root:{
            //     '&:hover': {
            //         // notchedOutline: {
            //             borderColor: '#EBEBEB'
            //         // }
            //     }
            // },
            notchedOutline: {
                borderColor: '#EBEBEB !important',
                borderWidth: '1px !important'
            }
        },
        MuiTextField: {

        },
        MuiToggleButtonGroup: {
          grouped: {
            '&:not(:first-child)': {
              borderLeft: '1px solid #EBEBEB'
            }
          }
        },
        // .MuiToggleButtonGroup-grouped:not(:first-child)
        MuiToggleButton: {
            root: {
                border: '1px solid #EBEBEB',
                backgroundColor: '#fff',
                '&.Mui-selected': {
                    // back
                    backgroundColor: '#fff !important',
                    color: '#000',
                    fontWeight: '500',
                    '&:hover': {
                        backgroundColor: '#fff !important',
                    }
                },
                '&:hover': {
                    backgroundColor: '#fff !important',
                }
            }
        }
    }
});
