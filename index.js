class PxCrypt {

    constructor({$inputData, $outputData, $pubURL, $pvtURL, $pubCan, $pvtCan}) {
        this.$inputData = $inputData;
        this.$outputData = $outputData;
        this.$pubURL = $pubURL;
        this.$pvtURL = $pvtURL;
        this.$pubCan = $pubCan;
        this.$pvtCan = $pvtCan;
    }

    clear() {
        this.$inputData.value = ' ';
        this.$outputData.value = '';
        this.$pvtURL.value = '';
        this.$pubURL.value = '';
        [this.$pvtCan, this.$pubCan].forEach(el => {
            el.getContext('2d').clearRect(0, 0, el.width, el.height);
        })
    }

    async encrypt() {
        const url = this.$pvtURL.value;
        const data = this.$inputData.value || ' ';
        if (await PxCrypt.isValidURL(url)) {
            const $pvtCan = this.$pvtCan;
            const $pubCan = this.$pubCan;
            const $outputData = this.$outputData;
            await PxCrypt.encode({
                url,
                data,
                $pubCan,
                $pvtCan
            });
            PxCrypt.decode({$pvtCan, $pubCan, $outputData});
        }
    }

    async decrypt() {
        const $pvtCan = this.$pvtCan;
        const $pubCan = this.$pubCan;
        const $outputData = this.$outputData;
        const pvtSuccess = await PxCrypt.loadImage(this.$pvtURL.value, $pvtCan);
        const pubSuccess = await PxCrypt.loadImage(this.$pubURL.value, $pubCan);
        if (pvtSuccess && pubSuccess) PxCrypt.decode({$pvtCan, $pubCan, $outputData});
    }

    static async loadImage(url, $el) {
        url = await PxCrypt.isValidURL(url) && url;
        return new Promise(resolve => {
            if (!url) resolve(false);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = url;
            img.onerror = error => {
                resolve(false);
            }
            img.onload = () => {
                $el.getContext('2d').drawImage(img, 0, 0);
                resolve(true);
            };
        });
    }

    static async isValidURL(url, timeout = 2500) {
        return new Promise(resolve => {
            const img = new Image();
            let timer;
            img.onerror = img.onabort = () => {
                clearTimeout(timer);
                resolve(false);
            };
            img.onload = () => {
                clearTimeout(timer);
                resolve(true);
            };
            timer = setTimeout(() => {
                img.src = 'fail.png';
                resolve(false);
            }, timeout);
            img.src = url;
        });
    }

    static storeDataInPixel({context, x, y, data:d}) {
        const pixel = context.getImageData(x, y, 1, 1);
        const data = pixel.data;
        // To prevent clamping we subtract at over 200
        // We are only interested in the difference
        data[0] = data[0] < 200 ? data[0] + d[0] : data[0] - d[0];
        data[1] = data[1] < 200 ? data[1] + d[1] : data[1] - d[1];
        data[2] = data[2] < 200 ? data[2] + d[2] : data[2] - d[2];
        context.putImageData(pixel, x, y);
        return context;
    }

    static diffPixel(pub, pvt) {
        const r = Math.abs(pub[0] - pvt[0]);
        const g = Math.abs(pub[1] - pvt[1]);
        const b = Math.abs(pub[2] - pvt[2]);
        return +`${r}${g}${b}`;
    }

    static encode({url, data, $pubCan, $pvtCan}) {
        return new Promise(resolve => {
            const pubCtx = $pubCan.getContext('2d');
            const pvtCtx = $pvtCan.getContext('2d');
            const img = new Image();
            function handler() {
                const width = $pubCan.width = $pvtCan.width = this.width;
                const height = $pubCan.height = $pvtCan.height = this.height;
                const reservePixels = 1;
                const availablePixels = (width * height) - reservePixels;
                const characters = data.length;
                pubCtx.drawImage(img, 0, 0);
                pvtCtx.drawImage(img, 0, 0);
                let skip = Math.floor(availablePixels / characters) || 1;
                if (skip > 999) skip = 999; // currently we are only supporting 1 character per channel
                // Store skip number in first pixel
                PxCrypt.storeDataInPixel({
                    context: pubCtx,
                    x: 0,
                    y: 0,
                    data: `000${skip}`.substr(-3, 3).split('').map(Number)
                });
                // Store data
                let i = 0;
                let k = 2;
                for (; i < data.length; i++) {
                    const character = data.charAt(i);
                    const ascii = data.charCodeAt(i);
                    const y = Math.floor(k / width);
                    const x = k - (width * y)
                    PxCrypt.storeDataInPixel({
                        context: pubCtx,
                        x,
                        y,
                        data: `000${ascii}`.substr(-3, 3).split('').map(Number)
                    });
                    k += skip;
                }
                resolve('success');
            }
            img.crossOrigin = 'anonymous';
            img.src = url;
            img.onload = handler;
            img.onerror = error => {
                resolve(`error: ${error}`);
            }
        });
    }

    static decode({$pvtCan, $pubCan, $outputData}) {
        const width = $pubCan.width;
        const availablePixels = width * $pubCan.height;
        const pub = $pubCan.getContext('2d');
        const pvt = $pvtCan.getContext('2d');
        const pubPx = pub.getImageData(0, 0, 1, 1).data;
        const pvtPx = pvt.getImageData(0, 0, 1, 1).data;
        const skip = PxCrypt.diffPixel(pubPx, pvtPx) || 1;
        let i = 2;
        let result = '';
        for (; i < availablePixels; i = i + skip) {
            const y = Math.floor(i / width);
            const x = i - (width * y)
            const pubPx = pub.getImageData(x, y, 1, 1).data;
            const pvtPx = pvt.getImageData(x, y, 1, 1).data;
            const character = PxCrypt.diffPixel(pubPx, pvtPx);
            if (character !== 0) { // TODO: Encode character length instead of ignoring null characters
                result += String.fromCharCode(character);
            }
        }
        $outputData.value = result;
    }

}

const $body = document.getElementsByTagName('body')[0];
const $form = document.getElementsByTagName('form')[0];
const $inputData = document.getElementById('input-data');
const $outputData = document.getElementById('output-data');
const $pubURL = document.getElementById('public-image-url');
const $pubCan = document.getElementById('public');
const $pvtURL = document.getElementById('private-image-url');
const $pvtCan = document.getElementById('private');
const pxCrypt = new PxCrypt({
    $inputData,
    $outputData,
    $pubURL,
    $pubCan,
    $pvtURL,
    $pvtCan
});

$form.onclick = event => {
    if (event.target.type !== 'radio') return;
    let selection = event.target.value;
    pxCrypt.clear();
    if (selection === 'encrypt-demo') {
        $inputData.value = document.getElementById('default-data').textContent.trim();
        $pvtURL.value = 'whiskey.png';
    }
    $body.setAttribute('class', selection);
    selection = selection === 'encrypt-demo' ? 'encrypt' : selection;
    pxCrypt[selection]();
}

$pvtURL.onkeyup = () => {
    let selection;
    $form.querySelectorAll('input').forEach(v => {
        if (v.checked) selection = v.value === 'encrypt-demo' ? 'encrypt' : v.value
    });
    pxCrypt[selection]();
};

$inputData.onkeyup = () => pxCrypt.encrypt();
$pubURL.onkeyup = () => pxCrypt.decrypt();
$form.querySelectorAll('input')[0].click();
