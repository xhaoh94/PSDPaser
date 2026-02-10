export interface Vector2 { x: number; y: number; }
export interface Vector3 { x: number; y: number; z: number; }
export interface Color { r: number; g: number; b: number; a: number; }

export interface RectTransformProps {
  anchorMin: Vector2;
  anchorMax: Vector2;
  anchoredPosition: Vector2;
  sizeDelta: Vector2;
  pivot: Vector2;
}

// Helper to format float
const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${Number(n.toFixed(5))}`);

export class YamlBuilder {
  private content: string[] = ['%YAML 1.1', '%TAG !u! tag:unity3d.com,2011:'];

  buildGameObject(fileId: string, name: string, componentIds: string[], isActive: boolean = true) {
    this.content.push(`--- !u!1 &${fileId}
GameObject:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  serializedVersion: 6
  m_Component:${componentIds.length > 0 ? '\n' + componentIds.map(id => `  - component: {fileID: ${id}}`).join('\n') : ' []'}
  m_Layer: 5
  m_Name: ${name}
  m_TagString: Untagged
  m_Icon: {fileID: 0}
  m_NavMeshLayer: 0
  m_StaticEditorFlags: 0
  m_IsActive: ${isActive ? 1 : 0}
`);
  }

  buildRectTransform(
    fileId: string, 
    gameObjectId: string, 
    props: RectTransformProps, 
    childrenIds: string[] = [], 
    parentId: string = '0'
  ) {
    this.content.push(`--- !u!224 &${fileId}
RectTransform:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_GameObject: {fileID: ${gameObjectId}}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 0, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_Children:${childrenIds.length > 0 ? '\n' + childrenIds.map(id => `  - {fileID: ${id}}`).join('\n') : ' []'}
  m_Father: {fileID: ${parentId}}
  m_RootOrder: 0
  m_LocalEulerAnglesHint: {x: 0, y: 0, z: 0}
  m_AnchorMin: {x: ${f(props.anchorMin.x)}, y: ${f(props.anchorMin.y)}}
  m_AnchorMax: {x: ${f(props.anchorMax.x)}, y: ${f(props.anchorMax.y)}}
  m_AnchoredPosition: {x: ${f(props.anchoredPosition.x)}, y: ${f(props.anchoredPosition.y)}}
  m_SizeDelta: {x: ${f(props.sizeDelta.x)}, y: ${f(props.sizeDelta.y)}}
  m_Pivot: {x: ${f(props.pivot.x)}, y: ${f(props.pivot.y)}}
`);
  }

  buildCanvasRenderer(fileId: string, gameObjectId: string) {
    this.content.push(`--- !u!222 &${fileId}
CanvasRenderer:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_GameObject: {fileID: ${gameObjectId}}
  m_CullTransparentMesh: 0
`);
  }

  buildImage(fileId: string, gameObjectId: string, spriteGuid: string, type: number = 0, color: Color = {r:1,g:1,b:1,a:1}) {
    const sprite = spriteGuid ? `{fileID: 21300000, guid: ${spriteGuid}, type: 3}` : `{fileID: 0}`;
    this.content.push(`--- !u!114 &${fileId}
MonoBehaviour:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_GameObject: {fileID: ${gameObjectId}}
  m_Enabled: 1
  m_EditorHideFlags: 0
  m_Script: {fileID: 11500000, guid: fe87c0e1cc204ed48ad3b37840f39efc, type: 3}
  m_Name: 
  m_EditorClassIdentifier: 
  m_Material: {fileID: 0}
  m_Color: {r: ${f(color.r)}, g: ${f(color.g)}, b: ${f(color.b)}, a: ${f(color.a)}}
  m_RaycastTarget: 1
  m_RaycastPadding: {x: 0, y: 0, z: 0, w: 0}
  m_Maskable: 1
  m_OnCullStateChanged:
    m_PersistentCalls:
      m_Calls: []
  m_Sprite: ${sprite}
  m_Type: ${type}
  m_PreserveAspect: 0
  m_FillCenter: 1
  m_FillMethod: 4
  m_FillAmount: 1
  m_FillClockwise: 1
  m_FillOrigin: 0
  m_UseSpriteMesh: 0
  m_PixelsPerUnitMultiplier: 1
`);
  }

  buildText(fileId: string, gameObjectId: string, text: string, fontSize: number, color: Color, align: string, fontGuid?: string, fontStyle: number = 0) {
    // Mapping alignment string to Unity TextAnchor enum (0-8)
    // UpperLeft=0, UpperCenter=1, UpperRight=2
    // MiddleLeft=3, MiddleCenter=4, MiddleRight=5
    // LowerLeft=6, LowerCenter=7, LowerRight=8
    
    let alignment = 0; // Default UpperLeft
    
    // Simplistic mapping based on horizontal alignment
    if (align === 'center') alignment = 4; // MiddleCenter
    else if (align === 'right') alignment = 5; // MiddleRight
    else alignment = 3; // MiddleLeft
    
    // Default Font (Arial): {fileID: 10102, guid: 0000000000000000e000000000000000, type: 0}
    // Custom Font: {fileID: 12800000, guid: <GUID>, type: 3}
    const font = fontGuid 
      ? `{fileID: 12800000, guid: ${fontGuid}, type: 3}`
      : `{fileID: 10102, guid: 0000000000000000e000000000000000, type: 0}`;

    this.content.push(`--- !u!114 &${fileId}
MonoBehaviour:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_GameObject: {fileID: ${gameObjectId}}
  m_Enabled: 1
  m_EditorHideFlags: 0
  m_Script: {fileID: 11500000, guid: 5f7201a12d95ffc409449d95f23cf332, type: 3}
  m_Name: 
  m_EditorClassIdentifier: 
  m_Material: {fileID: 0}
  m_Text: "${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
  m_FontData:
    m_Font: ${font}
    m_FontSize: ${fontSize}
    m_FontStyle: ${fontStyle}
    m_BestFit: 0
    m_MinSize: 0
    m_MaxSize: 40
    m_Alignment: ${alignment}
    m_AlignByGeometry: 0
    m_RichText: 1
    m_HorizontalOverflow: 0
    m_VerticalOverflow: 0
    m_LineSpacing: 1
  m_Color: {r: ${f(color.r)}, g: ${f(color.g)}, b: ${f(color.b)}, a: ${f(color.a)}}
  m_RaycastTarget: 1
  m_RaycastPadding: {x: 0, y: 0, z: 0, w: 0}
  m_Maskable: 1
  m_OnCullStateChanged:
    m_PersistentCalls:
      m_Calls: []
`);
  }

  buildOutline(fileId: string, gameObjectId: string, effectColor: Color, effectDistance: Vector2 = {x: 1, y: -1}, useGraphicAlpha: boolean = true) {
    this.content.push(`--- !u!114 &${fileId}
MonoBehaviour:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_GameObject: {fileID: ${gameObjectId}}
  m_Enabled: 1
  m_EditorHideFlags: 0
  m_Script: {fileID: 11500000, guid: e19747de3f5aca642ab2be37e372fb86, type: 3}
  m_Name: 
  m_EditorClassIdentifier: 
  m_EffectColor: {r: ${f(effectColor.r)}, g: ${f(effectColor.g)}, b: ${f(effectColor.b)}, a: ${f(effectColor.a)}}
  m_EffectDistance: {x: ${f(effectDistance.x)}, y: ${f(effectDistance.y)}}
  m_UseGraphicAlpha: ${useGraphicAlpha ? 1 : 0}
`);
  }

  toString() {
    return this.content.join('\n');
  }
}
