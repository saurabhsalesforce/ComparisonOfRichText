const createTextClass = 'html-diff-create-text';
const deleteTextClass = 'html-diff-delete-text';
const createImg = "html-diff-create-img";
const deleteImg = "html-diff-delete-img";
const htmlTagReg = /^<[^>]+>/;
const htmlImgTagReg = /^<img[^>]*>$/;


function wrapImg(type, str){
    if(type===0)
    {
        return str;
    }
    else if(type===1)
    {
        return `<div class="${createImg}" style="display:inline-block;
                    border: 4px solid rgb(176, 242, 255);
                    box-shadow: 0px 0px 10px 5px rgb(176, 242, 255);">${str}</div>`
    }
    else{
        return `<div class="${deleteImg}" style="display:inline-block;
                    border: 4px solid #7024c0;
                    box-shadow: 0px 0px 10px 5px #7024c0;
                    margin: 20px 20px">${str}</div>`
    }
}

function wrap(type, str)
{
    if(type===0)
    {
        return str;
    }
    else if(type===1)
    {
        return `<span class="${createTextClass}" style = "background:rgb(176, 242, 255)">${str}</span>`
    }
    else{
        return `<span class="${deleteTextClass}" style="color:#8e3ee2;
                    text-decoration-color:#7024c0;
                    text-decoration-line:line-through">${str}</span>`
    }
}
export function unified(diffs){
    var result = '';
    for(var i = 0; i<diffs.length; i++)
    {
        var arr = diffs[i][1];
        var str= '';
        for(var j = 0; j<arr.length; j++)
        {
            if(arr[j].match(htmlTagReg))
            {
                if(diffs[i][0]===0){
                    if(str)
                    {
                        result+=wrap(diffs[i][0], str);
                        str = '';
                    }
                    result+=arr[j];
                }
                else if(diffs[i][0]===1)
                {
                    if(str)
                    {
                        result+=wrap(diffs[i][0], str);
                        str = '';
                    }
                    if(arr[j].match(htmlImgTagReg))
                    {
                        result+=wrapImg(diffs[i][0], arr[j]);
                    }
                    else {
                        result+=arr[j];
                    }
                }
                else if(diffs[i][0]===-1)
                {
                    if(str)
                    {
                        result+=wrap(diffs[i][0], str);
                        str = '';
                    }
                    if(arr[j].match(htmlImgTagReg))
                    {
                        result+=wrapImg(diffs[i][0], arr[j]);
                    }
                }
            }
            else{
                if(arr[j]=== "." || arr[j]=== "39" || arr[j]=== "#" || arr[j]=== ";" || arr[j]==='&'||arr[j]=== ",")
                {

                }
                else{
                    str+=' ';
                }
                str+=arr[j];
            }
        }
        if(str)
        {
            result+=wrap(diffs[i][0], str);
            str = '';
        }
    }
    return result;
}