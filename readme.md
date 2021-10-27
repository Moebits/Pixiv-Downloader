## Pixiv Downloader

<img src="assets/images/readme.png">

### Output Template

You can customize the output file names. The default is `{title}*_p{page}*`. Adding slashes will create subfolders,
e.g. `${artist}/${title}`. Any asterisks will be removed, as they are a special option for page numbers. The following replacements are available:

{title} - The title of the illustration.
{id} - The id of the illustration.
\*{page}\* - The page number. The asterisk indicates that this will be omitted if there is only a single page.
{artist} - The artist of the illustration.
{user} - The pixiv id of the artist.
{user id} - The user id of the artist.
{date} - The date in YYYY-MM-DD format.
{width} - The width of the illustration.
{height} - The height of the illustration.

### Folder Mapping

An advanced option is to map images with certain tags into a subfolder. The folder mapping must be
in the format `folderName:tagName, folderName2:tagName2, folderName3:tagName3...`. Note that the list should
be comma separated. 

For example, if you search for "gabriel dropout" but want to map the different characters into sub-folders,
you should provide the folder mapping `gabriel:gabriel, satania:satania, raphiel:raphiel, vignette:vignette`. For more
accuracy provide the tags in Japanese, but they will be translated if you have the translate option enabled.